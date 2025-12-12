export const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 vUv;

void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uDensity;
uniform float uScatteringG;
uniform float uLightAngle;
uniform float uSteps;
uniform bool uDithering;
uniform float uShadowSoftness;

varying vec2 vUv;

#define PI 3.14159265359
#define MAX_DIST 20.0

// --- 伪随机与噪声 (Pseudo-Random & Noise) ---
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// 交叉梯度噪声 (Interleaved Gradient Noise) 用于抖动采样
float interleavedGradientNoise(vec2 uv) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(uv, magic.xy)));
}

// --- SDFs (符号距离函数) ---
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdPlane(vec3 p, float h) {
    return p.y - h;
}

// 场景地图函数
float map(vec3 p) {
    // 悬浮的立方体
    float box = sdBox(p - vec3(0.0, 1.0, 0.0), vec3(0.8, 1.2, 0.5));
    // 地面
    float plane = sdPlane(p, 0.0);
    return min(box, plane);
}

// --- 光照与阴影 (Lighting & Shadow) ---

// Henyey-Greenstein 相位函数
// g: 散射各向异性 (-1 到 1)
// cosTheta: dot(viewDir, lightDir)
float phaseHG(float g, float cosTheta) {
    float g2 = g * g;
    float num = 1.0 - g2;
    float denom = 4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
    return num / denom;
}

// 用于硬表面渲染的光线步进 (Raymarching)
float rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for(int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if(d < 0.001) break;
        t += d;
        if(t > MAX_DIST) break;
    }
    return t;
}

// 计算点是否在阴影中 (Raymarching Shadow)
float getShadow(vec3 p, vec3 lightPos) {
    vec3 l = normalize(lightPos - p);
    float distToLight = length(lightPos - p);
    
    float t = 0.1; // 偏移 bias
    float res = 1.0;
    
    // 简单的阴影光线步进
    for(int i = 0; i < 30; i++) {
        float h = map(p + l * t);
        // 软阴影逻辑 (Soft shadow logic)
        if( h < 0.001 ) return 0.0;
        res = min( res, uShadowSoftness * h / t );
        t += h;
        if(t > distToLight) break;
    }
    return clamp(res, 0.0, 1.0);
}

void main() {
    // 归一化坐标
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    
    // 摄像机设置
    vec3 ro = vec3(0.0, 2.5, -4.0); // 射线原点 (Ray Origin)
    vec3 lookAt = vec3(0.0, 1.0, 0.0);
    float zoom = 1.0;
    
    vec3 f = normalize(lookAt - ro);
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
    vec3 u = cross(f, r);
    vec3 rd = normalize(f * zoom + r * uv.x + u * uv.y); // 射线方向 (Ray Direction)

    // 光源设置 (移动的聚光灯)
    vec3 lightPos = vec3(sin(uLightAngle) * 3.0, 4.0, cos(uLightAngle) * 3.0);
    vec3 spotDir = normalize(vec3(0.0, 0.0, 0.0) - lightPos);
    vec3 lightColor = vec3(1.0, 0.9, 0.7) * 2.0;
    float spotCutoff = 0.9; // 切光角的余弦值

    // 1. 渲染场景表面
    float t = rayMarch(ro, rd);
    vec3 p = ro + rd * t;
    vec3 col = vec3(0.0);
    
    if(t < MAX_DIST) {
        // 简单的兰伯特 (Lambertian) 光照
        vec3 normal = vec3(0.0, 1.0, 0.0); 
        // 通过梯度计算法线，效果更好
        vec2 e = vec2(0.001, 0.0);
        vec3 n = normalize(vec3(
            map(p + e.xyy) - map(p - e.xyy),
            map(p + e.yxy) - map(p - e.yxy),
            map(p + e.yyx) - map(p - e.yyx)
        ));
        
        vec3 l = normalize(lightPos - p);
        float diff = max(dot(n, l), 0.0);
        float shadow = getShadow(p, lightPos);
        col = vec3(0.1) + vec3(0.5) * diff * shadow * lightColor;
    }

    // 2. 体积光线步进 (Volumetric Ray Marching)
    vec3 volCol = vec3(0.0);
    
    // 抖动采样 (Dithering)：减少低步数时的条纹伪影
    float noise = uDithering ? interleavedGradientNoise(gl_FragCoord.xy) : 0.0;
    
    float tVol = 0.0;
    // 我们只步进到表面击中点或最大距离
    float maxVolDist = (t < MAX_DIST) ? t : 8.0; 
    
    int steps = int(uSteps);
    float stepSize = maxVolDist / float(steps);
    
    // 随机偏移起始位置 (Jitter)
    tVol += stepSize * noise;

    for(int i = 0; i < 100; i++) {
        if(i >= steps) break;
        if(tVol >= maxVolDist) break;

        vec3 currP = ro + rd * tVol;

        // A. 聚光灯几何检测 (Spotlight Geometry Check)
        vec3 toLight = lightPos - currP;
        float distToLightSq = dot(toLight, toLight);
        vec3 lDir = normalize(toLight);
        
        float spotEffect = dot(-lDir, spotDir);
        
        if(spotEffect > spotCutoff) {
            // 聚光灯边缘柔化
            float intensity = smoothstep(spotCutoff, spotCutoff + 0.05, spotEffect);
            
            // B. 阴影贴图/SDF查询 (在此处进行 Raycast)
            float shadow = getShadow(currP, lightPos);
            
            if(shadow > 0.01) {
                // C. 相位函数 (Henyey-Greenstein)
                // 计算视线射线 (rd) 和光线向量 (lDir) 之间的夹角
                // 注意：标准 HG 使用入射光和出射光之间的 cosTheta。
                float cosTheta = dot(rd, lDir); 
                float phase = phaseHG(uScatteringG, cosTheta);
                
                // 累加光照
                // 比尔定律衰减 (Beer's Law) 的简化版
                float atten = 1.0 / (1.0 + distToLightSq * 0.1);
                
                volCol += lightColor * shadow * intensity * phase * uDensity * atten * stepSize;
            }
        }
        
        tVol += stepSize;
    }

    col += volCol;
    
    // 色调映射 (Tone mapping)
    col = col / (col + vec3(1.0));
    col = pow(col, vec3(1.0/2.2));

    gl_FragColor = vec4(col, 1.0);
}
`;
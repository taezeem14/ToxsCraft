// block.frag.glsl
uniform sampler2D uTextureAtlas;
uniform float uSunlightIntensity; // 0.1 to 1.0 depending on time of day
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vColor; // Baked Ambient Occlusion (AO) from GreedyMesher
varying vec3 vNormal;
varying float vViewDepth;

void main() {
    vec4 texColor = texture2D(uTextureAtlas, vUv);
    
    // Discard transparent pixels (glass, leaves transparent portions)
    if (texColor.a < 0.1) {
        discard;
    }

    // Lambertian lighting from directional sun
    vec3 sunDirection = normalize(vec3(0.5, 1.0, 0.3));
    float diffuse = max(0.4, dot(vNormal, sunDirection));
    
    // Combine texture, diffuse lighting, sunlight level, and baked AO
    vec3 litColor = texColor.rgb * vColor * (diffuse * uSunlightIntensity + 0.18);

    // Apply exponential fog: f = 1 - e^(-d * density)
    float fogFactor = 1.0 - exp(-vViewDepth * uFogDensity);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    
    vec3 finalColor = mix(litColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, texColor.a * uOpacity);
}

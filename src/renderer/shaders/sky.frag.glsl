// sky.frag.glsl
uniform vec3 uSunDirection;
uniform float uSunAltitude; // -1.0 (midnight) to 1.0 (noon)
uniform vec3 uDayColor;
uniform vec3 uSunsetColor;
uniform vec3 uNightColor;
uniform vec3 uHorizonColor;

varying vec3 vWorldPosition;

void main() {
    vec3 viewDir = normalize(vWorldPosition);
    
    // Height gradient factor (0.0 at horizon, 1.0 at zenith)
    float heightFactor = clamp(viewDir.y, 0.0, 1.0);
    
    // Sun proximity factor (1.0 directly looking at sun, 0.0 opposite)
    float sunProximity = max(0.0, dot(viewDir, uSunDirection));

    // Choose base colors based on sun altitude
    vec3 skyBase;
    vec3 horizonBase;
    
    if (uSunAltitude > 0.1) {
        // Full Day
        float transition = smoothstep(0.1, 0.3, uSunAltitude);
        skyBase = mix(uSunsetColor, uDayColor, transition);
        horizonBase = mix(uSunsetColor, uHorizonColor, transition);
    } else if (uSunAltitude > -0.1) {
        // Sunset / Sunrise
        float transition = (uSunAltitude - (-0.1)) / 0.2; // 0 to 1
        skyBase = mix(uNightColor, uSunsetColor, transition);
        horizonBase = mix(uNightColor, mix(uSunsetColor, uHorizonColor, 0.3), transition);
    } else {
        // Night
        float transition = smoothstep(-0.3, -0.1, uSunAltitude);
        skyBase = mix(uNightColor, uNightColor * 0.5, 1.0 - transition);
        horizonBase = mix(uNightColor * 0.3, uNightColor, transition);
    }

    // Blend sky zenith (top) with horizon (bottom)
    vec3 finalSky = mix(horizonBase, skyBase, heightFactor);

    // Add sun disk and solar halo
    if (uSunAltitude > -0.2) {
        float sunGlow = pow(sunProximity, 120.0) * 1.5; // sharp sun disc
        float corona = pow(sunProximity, 12.0) * 0.45;  // wide sun halo
        
        // Make sunset glow warmer (yellow-red)
        vec3 glowColor = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.95, 0.8), smoothstep(-0.1, 0.3, uSunAltitude));
        finalSky += (sunGlow + corona) * glowColor;
    }

    // Add moon disk (opposite to sun direction)
    vec3 moonDirection = -uSunDirection;
    float moonProximity = max(0.0, dot(viewDir, moonDirection));
    if (uSunAltitude < 0.2) {
        float moonGlow = pow(moonProximity, 150.0) * 0.9;
        float moonCorona = pow(moonProximity, 8.0) * 0.15;
        
        float nightStrength = smoothstep(0.2, -0.2, uSunAltitude);
        finalSky += (moonGlow + moonCorona) * vec3(0.85, 0.9, 1.0) * nightStrength;
    }

    gl_FragColor = vec4(finalSky, 1.0);
}

export const simVertexShader = `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUV;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUV = aPosition * 0.5 + 0.5;
}
`;

export const simFragmentShader = `#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uPrevState;
uniform vec2 uResolution;
uniform vec2 uMouseUV;
uniform float uMouseRadius;
uniform float uExplosionRadius;
uniform float uHasHover;
uniform float uMouseDown;

out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float torusDistance(vec2 p1, vec2 p2, vec2 resolution) {
    vec2 delta = p1 - p2;

    float dx = delta.x * resolution.x;
    if (abs(dx) > resolution.x * 0.5) {
        dx = resolution.x - abs(dx);
    } else {
        dx = abs(dx);
    }

    float dy = abs(delta.y * resolution.y);

    return sqrt(dx * dx + dy * dy);
}

void main() {
    vec2 pixelSize = 1.0 / uResolution;

    float count = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) continue;

            vec2 offset = vec2(float(x), float(y)) * pixelSize;
            vec2 samplePos = vUV + offset;

            samplePos.x = fract(samplePos.x);

            if (samplePos.y < 0.0) {
                samplePos.y = -samplePos.y;
                samplePos.x = fract(samplePos.x + 0.5);
            } else if (samplePos.y > 1.0) {
                samplePos.y = 2.0 - samplePos.y;
                samplePos.x = fract(samplePos.x + 0.5);
            }

            float cell = texture(uPrevState, samplePos).r;
            count += cell;
        }
    }

    float current = texture(uPrevState, vUV).r;

    float next = 0.0;
    if (current > 0.5) {
        if (count >= 2.0 && count <= 3.0) {
            next = 1.0;
        }
    } else {
        if (count >= 2.9 && count <= 3.1) {
            next = 1.0;
        }
    }

    if (uHasHover > 0.5) {
        float dist = torusDistance(vUV, uMouseUV, uResolution);

        if (uMouseDown > 0.5) {
            if (dist < uExplosionRadius) {
                if (random(vUV + uMouseUV) > 0.5) {
                    next = 1.0;
                }
            }
        } else {
            if (dist < uMouseRadius) {
                next = 1.0;
            }
        }
    }

    fragColor = vec4(next, next, next, 1.0);
}
`;

export const pickingVertexShader = `#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vObjectPos;

void main() {
    vObjectPos = aPosition;
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPos;
}
`;

export const pickingFragmentShader = `#version 300 es
precision highp float;

in vec3 vObjectPos;
out vec4 fragColor;

void main() {
    vec3 dir = normalize(vObjectPos);
    float u = atan(dir.z, dir.x) / (2.0 * 3.14159265359) + 0.5;
    float v = acos(dir.y) / 3.14159265359;

    fragColor = vec4(u, v, 1.0, 1.0);
}
`;

export const displayVertexShader = `#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vObjectPos;
out vec3 vWorldPos;
out vec3 vNormal;

void main() {
    vObjectPos = aPosition;
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = mat3(uModel) * aPosition;
    gl_Position = uProjection * uView * worldPos;
}
`;

export const displayFragmentShader = `#version 300 es
precision highp float;

in vec3 vObjectPos;
in vec3 vWorldPos;
in vec3 vNormal;

uniform sampler2D uTexture;

out vec4 fragColor;

void main() {
    vec3 dir = normalize(vObjectPos);

    float u = atan(dir.z, dir.x) / (2.0 * 3.14159265359) + 0.5;
    float v = acos(dir.y) / 3.14159265359;

    float val = texture(uTexture, vec2(u, v)).r;

    vec3 color = vec3(0.05, 0.05, 0.08);
    if (val > 0.5) {
        color = vec3(0.0, 1.0, 0.5);
    }

    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
    float diff = max(dot(normal, lightDir), 0.0);
    color *= (0.5 + 0.5 * diff);

    fragColor = vec4(color, 1.0);
}
`;

export const edgeVertexShader = `#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPos;
}
`;

export const edgeFragmentShader = `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

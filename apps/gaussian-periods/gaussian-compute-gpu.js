/**
 * WebGPU Compute Shader for Gaussian Periods
 * Parallelizes the main computation loop across GPU cores
 */

export class GaussianPeriodsGPUCompute {
    constructor() {
        this.device = null;
        this.adapter = null;
        this.isSupported = false;
        this.pipeline = null;
        this.bindGroupLayout = null;
    }

    /**
     * Initialize WebGPU device and create reusable pipeline
     */
    async initialize() {
        if (!navigator.gpu) {
            console.warn('WebGPU not supported in this browser');
            return false;
        }

        try {
            this.adapter = await navigator.gpu.requestAdapter();
            if (!this.adapter) {
                console.warn('No WebGPU adapter found');
                return false;
            }

            this.device = await this.adapter.requestDevice();
            this.device.lost.then((info) => {
                console.error('WebGPU device lost:', info.message);
            });

            // Create shader module once
            const shaderModule = this.device.createShaderModule({
                label: 'Gaussian Periods Compute Shader',
                code: this.getComputeShaderCode()
            });

            // Create bind group layout once
            this.bindGroupLayout = this.device.createBindGroupLayout({
                label: 'Compute Bind Group Layout',
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'uniform' }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 3,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 4,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'storage' }
                    }
                ]
            });

            // Create pipeline once
            this.pipeline = this.device.createComputePipeline({
                label: 'Gaussian Periods Compute Pipeline',
                layout: this.device.createPipelineLayout({
                    bindGroupLayouts: [this.bindGroupLayout]
                }),
                compute: {
                    module: shaderModule,
                    entryPoint: 'main'
                }
            });

            this.isSupported = true;
            console.log('✅ WebGPU initialized successfully');
            return true;
        } catch (error) {
            console.warn('Failed to initialize WebGPU:', error);
            return false;
        }
    }

    /**
     * Compute Gaussian periods on GPU
     * @param {number} n - Modulus
     * @param {number} omega - Generator
     * @param {Uint32Array} omegaPowers - Precomputed omega powers
     * @param {Float32Array} cosValues - Precomputed cosine values
     * @param {Float32Array} sinValues - Precomputed sine values
     * @param {number} bound - Number of periods to compute
     * @param {number} d - Multiplicative order
     * @returns {Promise<Array>} Array of computed points
     */
    async computePeriods(n, omega, omegaPowers, cosValues, sinValues, bound, d) {
        if (!this.isSupported) {
            throw new Error('WebGPU not supported');
        }

        const startTime = performance.now();

        // Create buffers for this computation
        const omegaPowersBuffer = this.createBuffer(omegaPowers, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        const cosValuesBuffer = this.createBuffer(cosValues, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        const sinValuesBuffer = this.createBuffer(sinValues, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

        // Output buffer for results (bound * 4 floats: real, imag, magnitude, argument)
        const outputSize = bound * 4 * Float32Array.BYTES_PER_ELEMENT;
        const outputBuffer = this.device.createBuffer({
            label: 'Output Buffer',
            size: outputSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        // Staging buffer for reading results back to CPU
        const stagingBuffer = this.device.createBuffer({
            label: 'Staging Buffer',
            size: outputSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        // Uniform buffer for parameters
        const paramsData = new Uint32Array([n, d, bound]);
        const paramsBuffer = this.createBuffer(paramsData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

        // Create bind group (uses cached layout)
        const bindGroup = this.device.createBindGroup({
            label: 'Compute Bind Group',
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: paramsBuffer } },
                { binding: 1, resource: { buffer: omegaPowersBuffer } },
                { binding: 2, resource: { buffer: cosValuesBuffer } },
                { binding: 3, resource: { buffer: sinValuesBuffer } },
                { binding: 4, resource: { buffer: outputBuffer } }
            ]
        });

        // Execute compute shader (uses cached pipeline)
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, bindGroup);

        // Dispatch workgroups (64 threads per workgroup)
        const workgroupSize = 64;
        const numWorkgroups = Math.ceil(bound / workgroupSize);
        passEncoder.dispatchWorkgroups(numWorkgroups);
        passEncoder.end();

        // Copy output to staging buffer
        commandEncoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, outputSize);

        // Submit commands and wait for completion
        this.device.queue.submit([commandEncoder.finish()]);

        // Wait for GPU to finish processing
        await this.device.queue.onSubmittedWorkDone();

        // Read results
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const resultData = new Float32Array(stagingBuffer.getMappedRange().slice(0));
        stagingBuffer.unmap();

        // Clean up buffers
        omegaPowersBuffer.destroy();
        cosValuesBuffer.destroy();
        sinValuesBuffer.destroy();
        outputBuffer.destroy();
        stagingBuffer.destroy();
        paramsBuffer.destroy();

        // Convert results to point objects
        const points = [];
        for (let i = 0; i < bound; i++) {
            const idx = i * 4;
            const real = resultData[idx];
            const imag = resultData[idx + 1];
            const magnitude = resultData[idx + 2];
            const argument = resultData[idx + 3];

            points.push({
                x: real,
                y: imag,
                k: i,
                real: real,
                imag: imag,
                magnitude: magnitude,
                argument: argument
            });
        }

        const elapsed = performance.now() - startTime;
        console.log(`🚀 GPU computation completed in ${elapsed.toFixed(2)}ms (${bound} points)`);

        return points;
    }

    /**
     * Create a GPU buffer from typed array
     */
    createBuffer(data, usage) {
        const buffer = this.device.createBuffer({
            size: data.byteLength,
            usage: usage,
            mappedAtCreation: true
        });

        if (data instanceof Uint32Array) {
            new Uint32Array(buffer.getMappedRange()).set(data);
        } else if (data instanceof Float32Array) {
            new Float32Array(buffer.getMappedRange()).set(data);
        }

        buffer.unmap();
        return buffer;
    }

    /**
     * WGSL Compute Shader Code
     */
    getComputeShaderCode() {
        return `
struct Params {
    n: u32,
    d: u32,
    bound: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> omegaPowers: array<u32>;
@group(0) @binding(2) var<storage, read> cosValues: array<f32>;
@group(0) @binding(3) var<storage, read> sinValues: array<f32>;
@group(0) @binding(4) var<storage, read_write> output: array<f32>;

// Safe modular multiplication to avoid u32 overflow
// Computes (a * b) % n without overflow
fn mulmod(a: u32, b: u32, n: u32) -> u32 {
    // For small enough values, direct computation works
    // Max safe value for direct multiplication: sqrt(2^32) ≈ 65536
    if (a < 65536u && b < 65536u) {
        return (a * b) % n;
    }

    // For larger values, use the Russian Peasant method
    // This computes (a * b) % n by repeated addition and doubling
    var result: u32 = 0u;
    var a_mod = a % n;
    var b_mod = b % n;

    while (b_mod > 0u) {
        if ((b_mod & 1u) == 1u) {
            result = (result + a_mod) % n;
        }
        a_mod = (a_mod * 2u) % n;
        b_mod = b_mod >> 1u;
    }

    return result;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let k = global_id.x;

    // Bounds check
    if (k >= params.bound) {
        return;
    }

    var sumReal: f32 = 0.0;
    var sumImag: f32 = 0.0;

    // Compute Gaussian period for this k
    for (var j: u32 = 0u; j < params.d; j = j + 1u) {
        let omegaPower = omegaPowers[j];

        // Compute (k * omegaPower) % n safely
        let exponent = mulmod(k, omegaPower, params.n);

        sumReal = sumReal + cosValues[exponent];
        sumImag = sumImag + sinValues[exponent];
    }

    // Compute magnitude and argument
    let magnitude = sqrt(sumReal * sumReal + sumImag * sumImag);
    let argument = atan2(sumImag, sumReal);

    // Store results (4 values per point: real, imag, magnitude, argument)
    let idx = k * 4u;
    output[idx] = sumReal;
    output[idx + 1u] = sumImag;
    output[idx + 2u] = magnitude;
    output[idx + 3u] = argument;
}
`;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }
        this.isSupported = false;
    }
}

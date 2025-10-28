/**
 * Equation Parser for BCC Lattice Shaders
 * Converts JavaScript-like math expressions to GLSL code
 */

/**
 * Parse user equation to GLSL code
 * @param {string} equation - User input like "t^3 + cos(x)sin(y)cos(z)"
 * @returns {{success: boolean, glslCode?: string, error?: string}}
 */
export function parseEquationToGLSL(equation) {
    try {
        if (!equation || equation.trim() === '') {
            return {
                success: false,
                error: 'Equation cannot be empty'
            };
        }

        // Tokenize and parse
        const tokens = tokenize(equation);
        const glslExpr = parseTokens(tokens);

        // Wrap in clamp to ensure [0,1] range
        const glslCode = `clamp(${glslExpr}, 0.0, 1.0)`;

        return {
            success: true,
            glslCode: glslCode
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Invalid equation syntax'
        };
    }
}

/**
 * Tokenize the input equation
 */
function tokenize(equation) {
    const tokens = [];
    let i = 0;
    const str = equation.replace(/\s+/g, ''); // Remove whitespace

    while (i < str.length) {
        const char = str[i];

        // Numbers (including decimals)
        if (char >= '0' && char <= '9' || char === '.') {
            let num = '';
            while (i < str.length && (str[i] >= '0' && str[i] <= '9' || str[i] === '.')) {
                num += str[i];
                i++;
            }
            tokens.push({ type: 'number', value: num });
            continue;
        }

        // Variables and functions
        if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')) {
            let name = '';
            while (i < str.length && ((str[i] >= 'a' && str[i] <= 'z') || (str[i] >= 'A' && str[i] <= 'Z'))) {
                name += str[i];
                i++;
            }

            // Check if it's a function (followed by '(')
            if (i < str.length && str[i] === '(') {
                tokens.push({ type: 'function', value: name });
            } else {
                tokens.push({ type: 'variable', value: name });
            }
            continue;
        }

        // Operators and parentheses
        if ('+-*/^()'.includes(char)) {
            tokens.push({ type: 'operator', value: char });
            i++;
            continue;
        }

        // Comma (for multi-arg functions)
        if (char === ',') {
            tokens.push({ type: 'comma', value: char });
            i++;
            continue;
        }

        throw new Error(`Unexpected character: ${char}`);
    }

    return tokens;
}

/**
 * Parse tokens into GLSL expression
 * Handles operator precedence and implicit multiplication
 */
function parseTokens(tokens) {
    let pos = 0;

    // Add implicit multiplication
    tokens = addImplicitMultiplication(tokens);

    function peek() {
        return tokens[pos];
    }

    function consume() {
        return tokens[pos++];
    }

    function parseExpression() {
        return parseAddSub();
    }

    function parseAddSub() {
        let left = parseMulDiv();

        while (peek() && peek().type === 'operator' && (peek().value === '+' || peek().value === '-')) {
            const op = consume().value;
            const right = parseMulDiv();
            left = `(${left} ${op} ${right})`;
        }

        return left;
    }

    function parseMulDiv() {
        let left = parsePower();

        while (peek() && peek().type === 'operator' && (peek().value === '*' || peek().value === '/')) {
            const op = consume().value;
            const right = parsePower();
            left = `(${left} ${op} ${right})`;
        }

        return left;
    }

    function parsePower() {
        let left = parseUnary();

        if (peek() && peek().type === 'operator' && peek().value === '^') {
            consume(); // consume '^'
            const right = parsePower(); // Right associative
            left = `pow(${left}, ${right})`;
        }

        return left;
    }

    function parseUnary() {
        if (peek() && peek().type === 'operator' && (peek().value === '+' || peek().value === '-')) {
            const op = consume().value;
            const expr = parseUnary();
            return op === '-' ? `(-${expr})` : expr;
        }

        return parsePrimary();
    }

    function parsePrimary() {
        const token = peek();

        if (!token) {
            throw new Error('Unexpected end of expression');
        }

        // Number
        if (token.type === 'number') {
            consume();
            // Ensure float literal in GLSL
            return token.value.includes('.') ? token.value : `${token.value}.0`;
        }

        // Variable
        if (token.type === 'variable') {
            consume();
            return mapVariable(token.value);
        }

        // Function
        if (token.type === 'function') {
            const funcName = consume().value;

            // Consume '('
            if (!peek() || peek().value !== '(') {
                throw new Error(`Expected '(' after function ${funcName}`);
            }
            consume();

            // Parse arguments
            const args = [];
            if (peek() && peek().value !== ')') {
                args.push(parseExpression());

                while (peek() && peek().type === 'comma') {
                    consume(); // consume ','
                    args.push(parseExpression());
                }
            }

            // Consume ')'
            if (!peek() || peek().value !== ')') {
                throw new Error(`Expected ')' after function arguments`);
            }
            consume();

            return mapFunction(funcName, args);
        }

        // Parentheses
        if (token.type === 'operator' && token.value === '(') {
            consume();
            const expr = parseExpression();

            if (!peek() || peek().value !== ')') {
                throw new Error('Mismatched parentheses');
            }
            consume();

            return `(${expr})`;
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    return parseExpression();
}

/**
 * Add implicit multiplication tokens
 * Examples: 2x -> 2*x, cos(x)sin(y) -> cos(x)*sin(y)
 */
function addImplicitMultiplication(tokens) {
    const result = [];

    for (let i = 0; i < tokens.length; i++) {
        result.push(tokens[i]);

        if (i < tokens.length - 1) {
            const current = tokens[i];
            const next = tokens[i + 1];

            // Add * between:
            // number followed by variable/function/open paren: 2x, 2(x+y), 2sin(x)
            // variable followed by variable/function/open paren: x(y+z), xsin(y)
            // close paren followed by number/variable/function/open paren: (x+y)2, (x+y)z, (x+y)sin(z)
            const needsMultiplication =
                (current.type === 'number' && (next.type === 'variable' || next.type === 'function' || (next.type === 'operator' && next.value === '('))) ||
                (current.type === 'variable' && (next.type === 'variable' || next.type === 'function' || (next.type === 'operator' && next.value === '('))) ||
                (current.type === 'operator' && current.value === ')' && (next.type === 'number' || next.type === 'variable' || next.type === 'function' || (next.type === 'operator' && next.value === '(')));

            if (needsMultiplication) {
                result.push({ type: 'operator', value: '*' });
            }
        }
    }

    return result;
}

/**
 * Map user variables to GLSL code with normalization to [-1, 1] range
 */
function mapVariable(name) {
    const varMap = {
        't': 'uTime',
        'x': '(vPosition.x / 70.0)',
        'y': '(vPosition.y / 70.0)',
        'z': '(vPosition.z / 70.0)',
        'pi': '3.14159265359',
        'e': '2.71828182846'
    };

    if (varMap[name.toLowerCase()]) {
        return varMap[name.toLowerCase()];
    }

    throw new Error(`Unknown variable: ${name}`);
}

/**
 * Map JavaScript-like functions to GLSL functions
 */
function mapFunction(name, args) {
    const funcMap = {
        'sin': 'sin',
        'cos': 'cos',
        'tan': 'tan',
        'asin': 'asin',
        'acos': 'acos',
        'atan': 'atan',
        'sqrt': 'sqrt',
        'abs': 'abs',
        'floor': 'floor',
        'ceil': 'ceil',
        'fract': 'fract',
        'mod': 'mod',
        'min': 'min',
        'max': 'max',
        'pow': 'pow',
        'exp': 'exp',
        'log': 'log',
        'sign': 'sign',
        'length': 'length',
        'random': 'random'
    };

    const glslFunc = funcMap[name.toLowerCase()];

    if (!glslFunc) {
        throw new Error(`Unknown function: ${name}`);
    }

    // Special handling for random function (pseudo-random using sin/fract)
    if (name.toLowerCase() === 'random') {
        if (args.length !== 1) {
            throw new Error(`Function random expects 1 argument, got ${args.length}`);
        }
        return `fract(sin(${args[0]}) * 43758.5453)`;
    }

    // Validate argument count for common functions
    const expectedArgs = {
        'sin': 1, 'cos': 1, 'tan': 1, 'sqrt': 1, 'abs': 1,
        'floor': 1, 'ceil': 1, 'fract': 1, 'exp': 1, 'log': 1, 'sign': 1,
        'min': 2, 'max': 2, 'pow': 2, 'mod': 2, 'atan': [1, 2],
        'clamp': 3, 'mix': 3, 'smoothstep': 3
    };

    if (expectedArgs[name.toLowerCase()]) {
        const expected = expectedArgs[name.toLowerCase()];
        const isValid = Array.isArray(expected)
            ? expected.includes(args.length)
            : args.length === expected;

        if (!isValid) {
            throw new Error(`Function ${name} expects ${expected} argument(s), got ${args.length}`);
        }
    }

    return `${glslFunc}(${args.join(', ')})`;
}

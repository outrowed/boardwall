import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

const stylisticConfig = stylistic.configs.customize({
    indent: 4,
    quotes: "double",
    jsx: true,
    semi: true,
});

// Statements that should be visually separated.
const spacedStatements = [
    "block-like",
    "if",
    "for",
    "while",
    "do",
    "switch",
    "try",
    "function",
    "class",
];

// Detect variables assigned directly to a function expression.
const functionVariable = {
    selector: "VariableDeclaration:has(VariableDeclarator[init.type=/^(ArrowFunctionExpression|FunctionExpression)$/])",
};

export default [
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "dist-server/**",
            "data/**",
            "dev/**",
        ],
    },
    {
        ...stylisticConfig,
        files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
        languageOptions: {
            parser: tseslint.parser,
        },
        rules: {
            ...stylisticConfig.rules,

            // Stroustrup brace style
            "@stylistic/brace-style": [
                "error",
                "stroustrup",
                { allowSingleLine: true },
            ],

            // Require multiline braces for 2+ statements.
            "@stylistic/curly-newline": [
                "error",
                {
                    minElements: 2,
                    consistent: true,
                },
            ],

            // The preset's max: 1 conflicts with inline blocks.
            "@stylistic/max-statements-per-line": "off",

            "@stylistic/padding-line-between-statements": [
                "error",

                // Blank line before control-flow statements and declarations.
                {
                    blankLine: "always",
                    prev: "*",
                    next: spacedStatements,
                },

                // Blank line after control-flow statements and declarations.
                {
                    blankLine: "always",
                    prev: spacedStatements,
                    next: "*",
                },

                // Blank line before an arrow function or function expression variable.
                {
                    blankLine: "always",
                    prev: "*",
                    next: functionVariable,
                },

                // Blank line after an arrow function or function expression variable.
                {
                    blankLine: "always",
                    prev: functionVariable,
                    next: "*",
                },
            ],

            // Keep objects and TypeScript member lists with 2+ items multiline.
            "@stylistic/object-curly-newline": [
                "error",
                {
                    ObjectExpression: {
                        minProperties: 2,
                        consistent: true,
                    },
                    TSInterfaceBody: {
                        minProperties: 2,
                        consistent: true,
                    },
                    TSTypeLiteral: {
                        minProperties: 2,
                        consistent: true,
                    },
                    TSEnumBody: {
                        minProperties: 2,
                        consistent: true,
                    },
                },
            ],
            "@stylistic/object-property-newline": [
                "error",
                { allowAllPropertiesOnSameLine: false },
            ],
        },
    },
];

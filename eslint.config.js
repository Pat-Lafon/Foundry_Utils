const foundryGlobals = {
    game: "readonly",
    canvas: "readonly",
    ui: "readonly",
    Dialog: "readonly",
    ChatMessage: "readonly",
    Roll: "readonly",
    CONFIG: "readonly",
    foundry: "readonly",
    Hooks: "readonly",
    Actor: "readonly",
    Item: "readonly",
    Token: "readonly",
};

const browserGlobals = {
    console: "readonly",
    document: "readonly",
    window: "readonly",
    Promise: "readonly",
};

const sharedRules = {
    "no-undef": "error",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-redeclare": "error",
};

export default [
    // Build output — ignore (auto-generated)
    { ignores: ["macros/*.js"] },
    // Macro source: ES modules with Foundry globals (pre-build)
    {
        files: ["macros/src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: { ...browserGlobals, ...foundryGlobals },
        },
        rules: sharedRules,
    },
    // Lib: ES modules (testable extracted logic)
    {
        files: ["lib/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: sharedRules,
    },
];

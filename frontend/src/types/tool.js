/**
 * @typedef {Object} ToolParameterProperty
 * @property {string} type
 * @property {string} description
 * @property {string[]} [enum]
 *
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {Object} parameters - OpenAI function calling parameters schema
 * @property {string} parameters.type
 * @property {Object.<string, ToolParameterProperty>} parameters.properties
 * @property {string[]} parameters.required
 * @property {(args: Object) => Promise<Object>} handler
 */

export {};

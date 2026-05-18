/**
 * MCP Server Registry
 * Defines available MCP servers and their connection parameters
 */

export const MCP_SERVERS = {
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github']
  }
};

/**
 * Get server configuration by name
 * @param {string} name - Server name
 * @returns {Object|null} Server configuration
 */
export function getServerConfig(name) {
  return MCP_SERVERS[name] || null;
}

/**
 * Get list of available server names
 * @returns {string[]} Array of server names
 */
export function getAvailableServers() {
  return Object.keys(MCP_SERVERS);
}

export default MCP_SERVERS;

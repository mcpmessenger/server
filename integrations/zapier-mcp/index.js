const authentication = require('./authentication');
const executeCommand = require('./resources/execute_command');
const executeWorkflow = require('./resources/execute_workflow');
const pingTrigger = require('./triggers/ping');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication,

  triggers: {
    [pingTrigger.key]: pingTrigger,
  },

  searches: {},

  actions: {
    [executeCommand.key]: executeCommand,
    [executeWorkflow.key]: executeWorkflow,
  },
}; 
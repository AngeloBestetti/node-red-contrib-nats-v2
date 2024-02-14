module.exports = function (RED) {
  function NatsServerNode (n) {
    RED.nodes.createNode(this, n)
    this.server = n.server
    this.user = n.user
    this.pass = n.pass
  }
  RED.nodes.registerType('nats-server', NatsServerNode)
}

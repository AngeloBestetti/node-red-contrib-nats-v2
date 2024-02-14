'use-strict'

const checkMSG = require('./checkMSG')
const connect = require('nats')

module.exports = function (RED) {
  function NatsPublishNode (config) {
    RED.nodes.createNode(this, config)
    const node = this
    setStatusRed()
    this.config = RED.nodes.getNode(config.server)
    this.server = this.config.server
    this.user = this.config.user
    this.pass = this.config.pass
    
  const servers = this.server.split(',')


    let nc = null
    let nodeIsClosing = false
    let reconnectTimer = null
    let natsnc = null
    
    ConnectionOptions = {
      servers: servers, 
      user: this.user,
      pass: this.pass,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1000,
    }
    console.log("Config: ", this.config)
    console.log("ConnectionOptions: ", ConnectionOptions)
    
    const connectNats = () => {
      nc = connect.connect(ConnectionOptions).then((nc) => {
        setStatusGreen()
        natsnc = nc
      }
      ).catch((err) => {
        node.log(err)
        setStatusRed()
      })



      return nc
    }

    (function reconnectHandler () {
      natsnc = connectNats()
    })()

    // on input send message
    node.on('input', function (msg) {
      let message
      let channel

      // checks if msg has configurations and sets them
      if (checkMSG(msg.payload)) {
        if (typeof msg.payload !== 'string') {
          try {
            message = JSON.stringify(msg.payload)
          } catch (err) {
            node.error(err, msg.payload)
          }
        } else {
          message = msg.payload
        }
      } else {
        message = config.message
      }

      if (checkMSG(msg.channel)) {
        channel = msg.channel
      } else {
        channel = config.channel
      }

      natsnc.publish(channel, message, function (err, guid) {
        if (err) {
          node.log('publish failed: ' + err)
        } else {
          if (config.log === true) {
            node.log('published message with guid: ' + guid)
          }
        }
      })
    })

    // on node close the nats stream connection is also closed
    node.on('close', function () {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
      }
      nodeIsClosing = true
      node.status({
        fill: 'red',
        shape: 'ring',
        text: 'disconnected'
      })
      natsnc.close()
    })

    function setStatusGreen () {
      node.status({
        fill: 'green',
        shape: 'dot',
        text: 'connected'
      })
    }

    function setStatusRed () {
      node.status({
        fill: 'red',
        shape: 'ring',
        text: 'disconnected'
      })
    }
  }
  RED.nodes.registerType('nats-publish', NatsPublishNode)
}

"use-strict";

const connect = require("nats");

module.exports = function (RED) {
  function NatsSubscribeNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    setStatusRed();

    this.config = RED.nodes.getNode(config.server);
    this.server = this.config.server;
    this.user = this.config.user;
    this.pass = this.config.pass;

    const servers = this.server.split(",");

    let nc = null;
    let natsnc = null;
    let nodeIsClosing = false;
    let subscription = null;
    let reconnectTimer = null;

    ConnectionOptions = {
      servers: servers,
      user: this.user,
      pass: this.pass,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1000,
    };

    // console.log("Config Subscription Connection: ", this.config);
    // console.log("ConnectionOptions: ", ConnectionOptions);

    const connectNats = () => {
      nc = connect
        .connect(ConnectionOptions)
        .then((nc) => {
          setStatusGreen();
          natsnc = nc;
          subs();
        })
        .catch((err) => {
          node.log(err);
          setStatusRed();
        });

      return nc;
    };
    

    (function reconnectHandler() {
      natsnc = connectNats();
    })();

    async function subs() {
      //console.log("Config Subscribe Options: ", JSON.stringify(config, null, 2));
      setStatusGreen();
      
      const sub = natsnc.subscribe(config.channel);

      for await (const m of sub) {
        handleMessage(m);
        // if (argv.headers && m.headers) {
        //   const h = [];
        //   for (const [key, value] of m.headers) {
        //     h.push(`${key}=${value}`);
        //   }
        //   console.log(`\t${h.join(";")}`);
        // }
      }
      await sub.drain();
      nc.drain();
    }

    node.on("disconnect", () => {
      node.log("disconnect");
      setStatusRed();
    });

    node.on("reconnect", () => {
      node.log("reconnect");
      setStatusGreen();
    });

    node.on("connection_lost", (err) => node.log("connection_lost " + err));

    (function reconnectHandler() {
      natsnc = connectNats();
      node.on("close", () => {
        setStatusRed();
        if (reconnectTimer === null && nodeIsClosing === false) {
          node.log("close received. Explicit reconnect attempt in 60 seconds.");
          reconnectTimer = setTimeout(() => {
            reconnectHandler();
            reconnectTimer = null;
          }, 1000 * 60);
        } else {
          node.log(
            "Node in flow is shutting down, not attempting to reconenct."
          );
        }

        natsnc = null;
      });
    })();

    // on node close the nats stream subscription is and connection is also closed
    node.on("close", function (done) {
      setStatusRed();
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      nodeIsClosing = true;
      // if the subscription is durable do not unsubscribe
      if (config.durable) {
        natsnc.drain();
        done();
      } else {
        subscription.unsubscribe();
        subscription.on("unsubscribed", function () {
          natsnc.drain();
          done();
        });
      }
    });

    function handleMessage(msg) {
      const msgToSend = {
        payload: `${msg.data}`,
        subject: msg.subject,
        streaming_msg: msg,
      };
      node.send(msgToSend);
    }

    function setStatusGreen() {
      node.status({
        fill: "green",
        shape: "dot",
        text: "connected",
      });
    }

    function setStatusRed() {
      node.status({
        fill: "red",
        shape: "ring",
        text: "disconnected",
      });
    }

    // checks if the string could be parsed to a date
    function checkDate(dateString) {
      const timeParts = dateString.split("-");

      // timeParts has to have 3 parts
      if (!(Object.keys(timeParts).length > 2)) {
        return false;
      }

      // the first part is the year and has to be 4 digits
      if (!/^\d\d\d\d$/.test(timeParts[0])) {
        return false;
      }

      // secound part is the month and has to be a number and between 1 and 12
      if (
        !(!isNaN(timeParts[1]) && +timeParts[1] >= 1 && +timeParts[1] <= 12)
      ) {
        return false;
      }

      // third part is the day and has to be a number and between 1 and 31
      if (isNaN(timeParts[2] && +timeParts[2] >= 1 && +timeParts[2] <= 31)) {
        return false;
      }

      return true;
    }
  }

  RED.nodes.registerType("nats-subscribe", NatsSubscribeNode);
};

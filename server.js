const { json } = require('stream/consumers');
const WebSocket = require('ws');

const wss = new WebSocket.Server({port : 1337});

console.log("Started websocket!");

const webClients = new Map();

wss.on("connection", ws =>{
    console.log("Connecteio");


    clientAPI = "";

    ws.on("message", message =>{

        console.log("New message");

        msgjson = JSON.parse(message);

        if(msgjson.type){
            if(msgjson.type === "auth"){
                clientAPI = msgjson.APIKey;
                webClients.set(clientAPI,ws);
                console.log(msgjson);
                setTimeout(()=>{
                    msg={
                        "type":"add",
                        "dataID":"TEST!",
                        "APIKey":"E2C820609140966AB26987D8839A7D6F8709A57B1788B427",
                        "name":"TEST",
                        "description":"TESTDESC",
                        "value":"100",
                        "status":"OK"
                    };
                    jsonmsg = JSON.stringify(msg);
                    console.log(msg);
                    ws.send(jsonmsg);    
                    },5000);
            }
            else if(msgjson.type === "data"){
                webClients[msgjson.APIKey].send(message);
            }
            else if(msgjson.type === "add"){

            }
        }

        
        
    });
    ws.on("close", ws =>{
        webClients.delete(clientAPI);
        console.log("dis");
    });


});

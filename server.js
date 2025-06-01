const mysql = require('mysql2')

const { json } = require('stream/consumers');
const WebSocket = require('ws');

const wss = new WebSocket.Server({port : 1337});

const sqlConnection = mysql.createConnection({
    host: '192.168.0.140',
    user: 'SMTServer',
    database: 'servermonitortool',
});


console.log("Started websocket!");

const webClients = new Map();

wss.on("connection", ws =>{
    console.log("User connected");


    clientAPI = "";

    ws.on("message", message =>{

        console.log("New message");

        msgjson = JSON.parse(message);
            if(msgjson.test == true && msgjson.source == "api"){
                console.log("Api connected");
            }
        
        if(msgjson.type){
            if(msgjson.type === "auth"){
 
                if(HandleAuth(msgjson) == false){
                    ws.close();
                }
    
            }
            else if(msgjson.type === "data"){
                //webClients[msgjson.APIKey].send(message);
            }
            else if(msgjson.type === "add"){
                console.log("Received json to add param")

            }
        }

        
        
    });
    ws.on("close", ws =>{
        webClients.delete(clientAPI);
        console.log("Lost Connection! Maybe disconnecteds");
    });


});

//For api auth, returns true for correct api, false otherwise
//For user, returns true
function HandleAuth(msgjson){
               
    ReceivedAPI = msgjson.APIKey;
    console.log(msgjson);

    if(msgjson.source == "client"){
        webClients.set(ReceivedAPI,ws);
        return true;
    }
    else if(msgjson.source == "api"){
        console.log("Checking api in db");


        query = `SELECT * FROM users WHERE api_key = \"${ReceivedAPI}\"`;
        console.log(query);
        sqlConnection.query(query,
            function(err, results, fields){
                if(results){
                    console.log(`Found api in database: ${ReceivedAPI}`);
                    return true;
                }
                else{
                    console.log(`Did not find api in database: ${ReceivedAPI}`);
                    return false;
                }
                    
            }
        )
    }
}
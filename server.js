const mysql = require('mysql2/promise')

const { json } = require('stream/consumers');

const WebSocket = require('ws');

const wss = new WebSocket.Server({port: 1337});


const sqlConnection = mysql.createPool({
    host: "dolphinsibiu.ddns.net",
    user: "SMTServer",
    password: "",
    database: "servermonitortool"
});

console.log("Started websocket!");

const webClients = new Map();

wss.on("connection", async ws =>{
    ws.bWebClient = false;

    ws.on("message", message =>{

        console.log("New message");

        msgjson = JSON.parse(message);
            if(msgjson.test == true && msgjson.source == "api"){
                console.log("Api connected");
            }
        
        if(msgjson.type){

            if(msgjson.type === "auth"){
                //if auth message comes from a web browser we don't need to check with db we just add them to connected user list
                if (msgjson.source == "client"){
                    console.log("Web client connected to server")
                    ws.bWebClient = true;
                    webClients.set(msgjson.APIKey,ws);
                    console.log(msgjson)
                }
                else if(await HandleAuth(msgjson) == false){
                    console.log("API tried to connect with wrong key")
                    SendAuthResult(ws,"rejected")
                    ws.close();
                }
                else if(msgjson.source == "api"){
                    console.log("API succesfully connected to server")
                    console.log(`Added api client to hashmap, api: ${msgjson.APIKey}`);
                    console.log(msgjson);
                    apiClients.set(msgjson.APIKey,ws);
                    SendAuthResult(ws,"accepted")
                }
                
    
            }
            //if the json contains data and the source is the api from the user's server we send it to the web if it exists
            else if(msgjson.type === "data" && msgjson.source === "api"){
                

                if(!apiClients.has(msgjson.APIKey)){
                    console.log("Unauthentificated api tries to send live data")
                }
                console.log("Received json to update param")
                //we check if the web is connected
                if(webClients.has(msgjson.APIKey)){
                    webClients.get(msgjson.APIKey).send(JSON.stringify(msgjson));
                }
                else{
                    console.log("Failed to find client in hashmap");
                }
            }
            else if(msgjson.type === "add"){
                console.log("Received json to add param")

            }
            else if(msgjson.type === "run_action"){
                console.log(`Received json to activate action, action_name: "${msgjson.actionID}"`)
                console.log(msgjson)
            }
        }

        
        
    });
    ws.on("close", ws =>{
        webClients.delete(clientAPI);
        console.log("Lost Connection! Maybe disconnecteds");
    });

    ws.send(JSON.stringify(GetTestJson()))
});

//For api auth, returns true for correct api, false otherwise
//For user, returns true
async function HandleAuth(msgjson){
               
    ReceivedAPI = msgjson.APIKey;
    console.log(msgjson);

    if(msgjson.source == "api"){
        console.log("Checking api in db");

        const [result] = await sqlConnection.query(
        "SELECT * FROM users WHERE api_key = ?",
        [ReceivedAPI]
    );

    if(result.length > 0) return true;
    return false;

    }
}


function IsAPIConnected(json){
    return apiClients.has(json.APIKey);
}

function SendAuthResult(ws, auth_result){
    resultjson = {
        type:"auth-status",
        result:auth_result
    }

    ws.send(JSON.stringify(resultjson));
}

function GetTestJson(){
    test_data_json = {
        type:"data",
        nameID:"Test_Name_From_Server",
        description:"Test_Description",
        unit:"Test_Unit",
        value:"Test_Value"

    }

    return test_data_json
}
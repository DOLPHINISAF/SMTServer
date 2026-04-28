const mysql = require('mysql2/promise')

const { json } = require('stream/consumers');

const WebSocket = require('ws');

const wss = new WebSocket.Server({port: 1337});
console.log("Started websocket!");

const sqlConnection = mysql.createPool({
    host: "dolphinsibiu.ddns.net",
    user: "SMTServer",
    password: "",
    database: "servermonitortool"
});


//each map stores the websockets for api and web
const webClients = new Map();
const apiClients = new Map();

wss.on("connection", (ws) =>{
    ws.bWebClient = false;
    ws.connectionKey = "";

    ws.on("message", async message =>{
        
        msgjson = {}
        try{
            msgjson = JSON.parse(message);
        }
        catch(e){
            console.log("Received message is not valid json");
            return;
        }

        switch(msgjson.type){
            case "auth-client":
                console.log("Web client connected to server")
                ws.bWebClient = true;
                ws.connectionKey = msgjson.APIKey;
                AddWebClients(ws.connectionKey, ws);
                break;
            case "auth-api":              
                if(await HandleAuth(msgjson) == false){
                    console.log("API tried to connect with wrong key")
                    SendAuthResult(ws,"rejected")
                    ws.close();
                }
                else{
                    ws.connectionKey = msgjson.APIKey;
                    apiClients.set(ws.connectionKey,ws);
                    SendAuthResult(ws,"accepted")
                }
                break;
            case "data":
                HandleParameterUpdate(msgjson);
                break;
            case "run_action":
                console.log(`Received json to activate action, action_name: "${msgjson.actionID}"`)
                if(apiClients.has(ws.connectionKey)){
                    apiClients.get(ws.connectionKey).send(JSON.stringify(msgjson));
                    console.log("Sent message to activate action to api", msgjson)
                }
                else console.log("Failed to find api client in hashmap");
                break;
            case "store":
                await StoreToDb(msgjson)
                break;
            case "load-user-config":
                const userConfig = {
                    type:"user-config"
                }
                Object.assign(userConfig, await GetConfigFromDb(ws.connectionKey));

                ws.send(JSON.stringify(userConfig));
                console.log("Sent user config to web client");
                console.log(userConfig);
                break;
            case "action_status":
                HandleStatusUpdate(msgjson);
                break;
            case "remove":
                RemoveFromDb(msgjson);
                break;
            default:
                console.log("Received unknown message");
        }
            
    });


    ws.on("close", (code, reason) =>{
        if(ws.bWebClient){
            //webClients.delete(ws.connectionKey);
            RemoveWebClient(ws.connectionKey, ws);
            console.log("Web Client disconnected!")
        }
        else{
            apiClients.delete(ws.connectionKey);
            console.log("API disconnected!")
        }
        
    });

});

//True if found in db, false otherwise
async function HandleAuth(msgjson){
               
    ReceivedAPI = msgjson.APIKey;
    console.log(msgjson);


    const [result] = await sqlConnection.query(
        "SELECT * FROM users WHERE api_key = ?",
        [ReceivedAPI]
        );

    if(result.length > 0) return true;
    return false;

}

function HandleStatusUpdate(msgjson){
    if(!apiClients.has(msgjson.APIKey)){
            console.log("Unauthentificated api tries to send live data")
        }
    console.log("Received json to update action status")
    //we check if the web is connected
    if(webClients.has(msgjson.APIKey)){
        //webClients.get(msgjson.APIKey).send(JSON.stringify(msgjson));
        const webClientsList = webClients.get(msgjson.APIKey);

        webClientsList.forEach(ws => {
            ws.send(JSON.stringify(msgjson));
        });

    }
    else{
        console.log("Failed to find client in hashmap");
    }
}

function HandleParameterUpdate(msgjson){
    if(!apiClients.has(msgjson.APIKey)){
            console.log("Unauthentificated api tries to send live data")
        }
    console.log("Received json to update param")
    //we check if the web is connected
    if(webClients.has(msgjson.APIKey)){
        //webClients.get(msgjson.APIKey).send(JSON.stringify(msgjson));
        const webClientsList = webClients.get(msgjson.APIKey);

        webClientsList.forEach(ws => {
            ws.send(JSON.stringify(msgjson));
        });
    }
    else{
        console.log("Failed to find client in hashmap");
    }
}

async function RemoveFromDb(msgjson){
    console.log("User trying to delete parameter/action")
    newUserConfig = {}

    const oldUserConfig = await GetConfigFromDb(msgjson.APIKey);
    console.log(oldUserConfig);
    newUserConfig = oldUserConfig;
    if(msgjson.itemtype === "parameter"){
        newUserConfig.parameters = newUserConfig.parameters.filter(parameter => parameter.nameID !== msgjson.name);
    }
    if(msgjson.itemtype === "action"){
        newUserConfig.actions = newUserConfig.actions.filter(action => action.actionID !== msgjson.name);
    }
    console.log(newUserConfig);
    
    await sqlConnection.query(
        "UPDATE users SET user_config = ? WHERE api_key = ?",
        [JSON.stringify(newUserConfig), msgjson.APIKey]
    );
    
}

async function StoreToDb(msgjson){
    console.log(msgjson);
    const currentUserConfig = await GetConfigFromDb(msgjson.APIKey);

    if(msgjson.storetype === "parameter"){
        
        const parameter = {}
        parameter.nameID = msgjson.nameID;
        parameter.description = msgjson.description;
        parameter.unit = msgjson.unit;

        console.log(`User trying to store new parameter `)
        console.log(parameter)

        currentUserConfig.parameters.push(parameter)
    }
    else if(msgjson.storetype === "action"){
        

        const action = {}
        action.actionID = msgjson.actionID;
        action.actiondescription = msgjson.actiondescription;

        console.log(`User trying to store new action`)
        console.log(action)

        currentUserConfig.actions.push(action)
    }
    else{
        console.log("StoreToDb - Unknown storetype");
    }

    await sqlConnection.query(
        "UPDATE users SET user_config = ? WHERE api_key = ?",
        [JSON.stringify(currentUserConfig), msgjson.APIKey]
    );
}

async function GetConfigFromDb(apiKey) {
    try {
        const [rows] = await sqlConnection.query(
            "SELECT user_config FROM users WHERE api_key = ?",
            [apiKey]
        );

        if (rows.length == 0) {
            return null; // invalid API key
        }
        return rows[0].user_config; // already JSON if MySQL JSON type
    } 
    catch (err) {
        console.error("DB error:", err);
        
    }
}

function SendAuthResult(ws, auth_result){
    resultjson = {
        type:"auth-status",
        result:auth_result
    }

    ws.send(JSON.stringify(resultjson));
}


function AddWebClients(apiKey, ws){
    if (!webClients.has(apiKey)) {
        webClients.set(apiKey, new Set());
    }

    webClients.get(apiKey).add(ws);
}
function RemoveWebClient(apiKey, ws) {
    if (!webClients.has(apiKey)) return;

    const clients = webClients.get(apiKey);
    clients.delete(ws);

    if (clients.size === 0) {
        webClients.delete(apiKey);
    }
}
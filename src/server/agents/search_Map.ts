
import { AgentState } from "../graph/state";
import { getNearestSupermarket, autoCompleteAddress, getLatLongFromID } from "../tools/getNearestSupermarket";
// import { RunnableConfig } from "@langchain/core/runnables";

export const searchMapNode = async (state: typeof AgentState.State, config: any) => {
    const userCurrentLocation = config.configurable?.user_current_location;
    let originID = null;
    let destinationID = null;
    let current_origin_address = null;
    let current_destination_address = null;
    let brand_preference = null;
    let originLocation = null;
    let destinationLocation = null;
    console.log("**********************************************************************\n");
    console.time("⏱️ SEARCH MAP running TIME:");
    // console.log("state.current_origin_address: ", state.current_origin_address);
    // console.log("state.current_destination_address: ", state.current_destination_address);
    // console.log("userCurrentLocation: ", userCurrentLocation);
    if(state.current_origin_address.adressName){
        if(state.current_origin_address.adressName!=='user_location'){
            current_origin_address = await autoCompleteAddress(state.current_origin_address.adressName);
            if(current_origin_address){
                originID = current_origin_address?.placePrediction?.placeId || null; 
                if(originID){
                    originLocation = await getLatLongFromID(originID) || null;
                }
            }
        }
    }


    if(state.current_destination_address.adressName){
        current_destination_address = await autoCompleteAddress(state.current_destination_address.adressName);
        if(current_destination_address){
            destinationID = current_destination_address?.placePrediction?.placeId || null; 
            if(destinationID){
                destinationLocation = await getLatLongFromID(destinationID) || null;
            }
        }
    }

    if(state.brand_preference){
        if(state.brand_preference.includes("Any")){
            brand_preference = "Coles Woolworths Aldi";
        }else{
            brand_preference = state.brand_preference;
        }
    }
    console.log("originID: ", originID);
    console.log("destinationID: ", destinationID);
    console.log("brand_preference: ", brand_preference);
    console.log("userCurrentLocation: ", userCurrentLocation);

    const nearestSupermarket = await getNearestSupermarket(userCurrentLocation, originID, destinationID, brand_preference);
    console.log("nearestSupermarket: ", nearestSupermarket);
    console.timeEnd("⏱️ SEARCH MAP running TIME:");
    console.log("**********************************************************************\n");
    
    return { 
        finished_branches: ["search_map_done"], 
        optimized_route_map: nearestSupermarket,
        current_origin_address: {  
            adressName: current_origin_address?.placePrediction.text.text || null,
            adressID: originID || null,
            location: originLocation || null
        },
        current_destination_address: {  
            adressName: current_destination_address?.placePrediction.text.text || null,
            adressID: destinationID || null,
            location: destinationLocation || null
        },
        brand_preference: brand_preference,
        user_current_location: userCurrentLocation,
    };
};


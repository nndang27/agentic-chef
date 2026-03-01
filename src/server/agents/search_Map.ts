
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
    console.log("===================================================");
    console.log("state.current_origin_address: ", state.current_origin_address);
    console.log("state.current_destination_address: ", state.current_destination_address);
    console.log("userCurrentLocation: ", userCurrentLocation);
    if(state.current_origin_address.adressName){
        current_origin_address = await autoCompleteAddress(state.current_origin_address.adressName);
        originID = current_origin_address.placePrediction.placeId;
        originLocation = await getLatLongFromID(originID);
    }


    if(state.current_destination_address.adressName){
        current_destination_address = await autoCompleteAddress(state.current_destination_address.adressName);
        destinationID = current_destination_address.placePrediction.placeId;
        destinationLocation = await getLatLongFromID(destinationID);
    }

    if(state.brand_preference){
        brand_preference = state.brand_preference;
    }

    const nearestSupermarket = await getNearestSupermarket(userCurrentLocation, originID, destinationID, brand_preference);

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


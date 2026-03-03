
import { AgentState } from "../graph/state";
import { getNearestSupermarket, autoCompleteAddress, getLatLongFromID } from "../tools/getNearestSupermarket";
// import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
export const searchMapNode = async (state: typeof AgentState.State, config: any) => {
    const userCurrentLocation = config.configurable?.user_current_location;
    console.log("userCurrentLocation99999999: ", userCurrentLocation);
    let originID = null;
    let destinationID = null;
    let current_origin_address = null;
    let current_destination_address = null;
    let brand_preference = "Coles Woolworths Aldi";
    let originLocation = null;
    let destinationLocation = null;
    console.log("**********************************************************************\n");
    console.time("⏱️ SEARCH MAP running TIME:");
    // console.log("state.current_origin_address: ", state.current_origin_address);
    // console.log("state.current_destination_address: ", state.current_destination_address);
    // console.log("userCurrentLocation: ", userCurrentLocation);
    if(state.quickMode.length > 0){
        if(state.quickMode.includes("MAP")){
            if(state.quickQuery.mapOrigin !== ""){
                state.current_origin_address = {
                    adressName: state.quickQuery.mapOrigin,
                    adressID: null,
                    location: null
                };

            }
            if(state.quickQuery.mapDestination !== ""){
                state.current_destination_address = {
                    adressName: state.quickQuery.mapDestination,
                    adressID: null,
                    location: null
                };
            }
            if(state.quickQuery.mapSupermarket !== ""){
                state.brand_preference = state.quickQuery.mapSupermarket;
            }
        }
    }


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


    if (state.brand_preference) {
        // 1. Chuyển chuỗi về chữ thường để dễ so sánh
        const prefText = state.brand_preference.toLowerCase();

        // 2. Đặt các cờ (flags) kiểm tra
        const hasAny = prefText.includes("any");
        const hasColes = prefText.includes("coles");
        const hasWoolworths = prefText.includes("woolworth"); // Tìm "woolworth" sẽ bắt được cả "woolworths"

        // 3. Xử lý logic theo thứ tự ưu tiên
        if (hasAny) {
            brand_preference = "Coles Woolworths Aldi";
        } 
        else if (hasColes && hasWoolworths) {
            brand_preference = "Coles Woolworths";
        } 
        else if (hasColes) {
            brand_preference = "Coles";
        } 
        else if (hasWoolworths) {
            brand_preference = "Woolworths";
        } 
        else {
            // Trường hợp không có chữ nào liên quan đến Coles, Woolworths hay Any
            brand_preference = "Coles Woolworths Aldi";
        }
    }
    // console.log("originID: ", originID);
    // console.log("destinationID: ", destinationID);
    // console.log("brand_preference: ", brand_preference);
    // console.log("userCurrentLocation: ", userCurrentLocation);
    await dispatchCustomEvent(
        "node_progress", // Tên sự kiện (bạn tự đặt)
        { message: `Searching for optimized route...` }, 
        config 
    );
  
    const nearestSupermarket = await getNearestSupermarket(userCurrentLocation, originID, destinationID, brand_preference);
    // console.log("nearestSupermarket: ", nearestSupermarket);
    console.timeEnd("⏱️ SEARCH MAP running TIME:");
    console.log("**********************************************************************\n");
    
    return { 
        finished_branches: ["search_map_done"], 
        optimized_route_map: nearestSupermarket || null,
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
        user_current_location: userCurrentLocation || null,
    };
};



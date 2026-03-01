const productUrl = "https://www.coles.com.au/product/5448589"
const matches = productUrl.match(/-(\d+)$/) || productUrl.match(/\/(\d+)$/);
console.log(matches)
// if (matches && matches[1]) {
//     const id = matches[1];
//     // CDN chính chủ Coles (Luôn sống)
//     console.log(`https://product-images.coles.com.au/product/images/w/${id}.jpg`);
// }
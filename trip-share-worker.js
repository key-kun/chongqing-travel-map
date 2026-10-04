/* Bounded lifetime: the main page terminates malformed/expensive share input. */
importScripts('vendor/lz-string.min.js');
onmessage=e=>{try{const text=LZString.decompressFromEncodedURIComponent(e.data);if(!text||text.length>500000)throw Error();postMessage({text});}catch{postMessage({error:true});}};

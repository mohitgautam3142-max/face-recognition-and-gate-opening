const video = document.getElementById("video")
const statusText = document.getElementById("status")

let registeredDescriptor = null
let bluetoothCharacteristic = null
let modelsLoaded = false

async function startCamera(){

const stream = await navigator.mediaDevices.getUserMedia({video:true})
video.srcObject = stream

}

async function loadModels(){

await faceapi.nets.tinyFaceDetector.loadFromUri("https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/models")
await faceapi.nets.faceLandmark68Net.loadFromUri("https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/models")
await faceapi.nets.faceRecognitionNet.loadFromUri("https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/models")

modelsLoaded = true

statusText.innerText = "AI Ready - Start Camera"

startCamera()

}

loadModels()

async function registerFace(){

if(!modelsLoaded){
statusText.innerText = "Models still loading..."
return
}

const detection = await faceapi
.detectSingleFace(video,new faceapi.TinyFaceDetectorOptions())
.withFaceLandmarks()
.withFaceDescriptor()

if(!detection){
statusText.innerText = "No face detected - Try again"
return
}

registeredDescriptor = detection.descriptor

localStorage.setItem(
"registeredFace",
JSON.stringify(Array.from(registeredDescriptor))
)

statusText.innerText = "Face Registered Successfully"

}

function loadRegisteredFace(){

const data = localStorage.getItem("registeredFace")

if(data){

registeredDescriptor = new Float32Array(JSON.parse(data))
statusText.innerText = "Registered face loaded"

}

}

loadRegisteredFace()

async function recognizeFace(){

if(!modelsLoaded) return
if(!registeredDescriptor) return

const detection = await faceapi
.detectSingleFace(video,new faceapi.TinyFaceDetectorOptions())
.withFaceLandmarks()
.withFaceDescriptor()

if(!detection){

statusText.innerText = "No Face Detected"
return

}

const distance = faceapi.euclideanDistance(
detection.descriptor,
registeredDescriptor
)

console.log("Face distance:",distance)

if(distance < 0.5){

statusText.innerText = "Gate OPEN - Authorized Person"

sendBluetooth("1")

}else{

statusText.innerText = "Unknown Person Detected - Gate Closed"

sendBluetooth("0")

}

}

setInterval(recognizeFace,1500)

async function connectBluetooth(){

try{

const device = await navigator.bluetooth.requestDevice({
acceptAllDevices:true,
optionalServices:["ffe0"]
})

const server = await device.gatt.connect()

const service = await server.getPrimaryService("ffe0")

bluetoothCharacteristic = await service.getCharacteristic("ffe1")

statusText.innerText = "Bluetooth Connected"

}catch(error){

statusText.innerText = "Bluetooth Connection Failed"

}

}

function sendBluetooth(value){

if(!bluetoothCharacteristic) return

let encoder = new TextEncoder()

bluetoothCharacteristic.writeValue(encoder.encode(value))

console.log("Bluetooth Sent:",value)

}

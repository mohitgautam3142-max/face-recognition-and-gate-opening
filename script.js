const video = document.getElementById("video")
const statusText = document.getElementById("status")

let registeredDescriptor = null
let bluetoothCharacteristic = null

async function startCamera(){

const stream = await navigator.mediaDevices.getUserMedia({ video:{} })
video.srcObject = stream

}

startCamera()

async function loadModels(){

await faceapi.nets.tinyFaceDetector.loadFromUri("https://cdn.jsdelivr.net/npm/face-api.js/models")
await faceapi.nets.faceLandmark68Net.loadFromUri("https://cdn.jsdelivr.net/npm/face-api.js/models")
await faceapi.nets.faceRecognitionNet.loadFromUri("https://cdn.jsdelivr.net/npm/face-api.js/models")

}

loadModels()

async function registerFace(){

const detection = await faceapi.detectSingleFace(
video,
new faceapi.TinyFaceDetectorOptions()
).withFaceLandmarks().withFaceDescriptor()

if(!detection){
statusText.innerText = "No face detected"
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
}

}

loadRegisteredFace()

async function recognizeFace(){

const detection = await faceapi.detectSingleFace(
video,
new faceapi.TinyFaceDetectorOptions()
).withFaceLandmarks().withFaceDescriptor()

if(!detection || !registeredDescriptor) return

const distance = faceapi.euclideanDistance(
detection.descriptor,
registeredDescriptor
)

if(distance < 0.5){

statusText.innerText = "Gate OPEN - Authorized Person"

sendBluetooth("1")

}
else{

statusText.innerText = "Unknown Person - Gate Closed"

sendBluetooth("0")

}

}

setInterval(recognizeFace,1000)

async function connectBluetooth(){

const device = await navigator.bluetooth.requestDevice({
acceptAllDevices:true,
optionalServices:["ffe0"]
})

const server = await device.gatt.connect()

const service = await server.getPrimaryService("ffe0")

bluetoothCharacteristic = await service.getCharacteristic("ffe1")

statusText.innerText = "Bluetooth Connected"

}

function sendBluetooth(value){

if(!bluetoothCharacteristic) return

let encoder = new TextEncoder()

bluetoothCharacteristic.writeValue(encoder.encode(value))

}

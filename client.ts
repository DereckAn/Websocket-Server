import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Enter a message: "
});

const socket = new WebSocket("ws://localhost:3000");

socket.addEventListener("open", () => {
  console.log("WebSocket connection established");

  // Send a test message
  socket.send("Hello from client!");

  // Send another message after 2 seconds
  setTimeout(() => {
    socket.send("This is another test message");
  }, 2000);
});

socket.addEventListener("close", () => {
  console.log("WebSocket connection closed");
    rl.close();
});

socket.addEventListener("message", (event) => {
  console.log("Message from server:", event.data);
});

socket.addEventListener("error", (error) => {
  console.error("WebSocket error:", error);
});

rl.on("line", (line) => {
  if (line.trim() === "exit") {
    console.log("Exiting...");
    socket.close();
    return;
  }
  
  // Send the input line to the WebSocket server
  socket.send(line);
});
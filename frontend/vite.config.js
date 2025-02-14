import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0", // Allow external access
    port: 5173, // Ensure it's set to the correct port
    strictPort: true, // Prevents port fallback
    cors: true, // Enable CORS if needed
    allowedHosts: ["ec2-52-86-62-188.compute-1.amazonaws.com"], // Allow EC2 public hostname
  },
})
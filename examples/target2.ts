import { serve } from "https://deno.land/std@0.50.0/http/server.ts";
const s = serve({ port: 3200 });

console.log("http://localhost:3200/");

for await (const req of s) {
  req.respond({ body: "Hello World\n" });
}
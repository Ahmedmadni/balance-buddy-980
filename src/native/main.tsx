import React from "react";
import {createRoot} from "react-dom/client";
import {NativeApp} from "./NativeApp";
import "./native.css";
const node=document.getElementById("root");
if(!node)throw new Error("Missing root");
createRoot(node).render(<React.StrictMode><NativeApp/></React.StrictMode>);

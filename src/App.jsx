import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Chat from "./components/Chat";

function App() {
  const token = localStorage.getItem("token");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/chat" /> : <Login />} />
        <Route path="/chat" element={token ? <Chat /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
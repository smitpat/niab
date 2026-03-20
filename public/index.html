<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Nouns in a Bucket</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes slideDown { 0% { transform: translateY(-100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .toast-animate { animation: slideDown 0.3s ease-out forwards; }
    </style>
</head>
<body class="bg-gray-100 text-gray-900 font-sans antialiased p-4 pb-16">
    
    <div id="toast-container" class="hidden fixed top-4 left-0 w-full z-50 flex justify-center px-4">
        <div class="bg-red-500 text-white font-black text-xl px-6 py-4 rounded-xl shadow-2xl border-4 border-red-700 toast-animate">
            🚨 HURRY UP! PEOPLE ARE WAITING! 🚨
        </div>
    </div>

    <div id="app" class="relative max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6 mt-4">
        
        <div id="pause-overlay" class="hidden absolute inset-0 bg-white/90 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-4 text-center">
            <h2 class="text-4xl font-black text-indigo-600 mb-2">PAUSED</h2>
            <p id="pause-text" class="text-gray-600 font-bold mb-8">Paused by Player</p>
            <button id="btn-resume" class="w-full max-w-xs bg-indigo-500 text-white font-black p-4 rounded-xl shadow-lg text-xl active:bg-indigo-600 border-b-4 border-indigo-700">▶️ Resume Game</button>
        </div>

        <h1 class="text-3xl font-bold text-center text-indigo-600 mb-6">Nouns in a Bucket</h1>

        <div id="landing-screen" class="space-y-4">
            <input type="text" id="playerName" placeholder="Your Name" class="w-full p-3 border rounded-lg text-lg">
            <button id="btn-rejoin" class="hidden w-full bg-yellow-500 text-white font-bold p-3 rounded-lg shadow mt-2">Rejoin Active Game</button>
            <div class="border-t pt-4">
                <h3 class="font-bold mb-2">Join Game</h3>
                <div class="flex space-x-2">
                    <input type="text" id="joinCode" placeholder="Room Code" class="w-2/3 p-3 border rounded-lg uppercase text-xl font-bold text-center">
                    <button id="btn-join" class="w-1/3 bg-blue-500 text-white font-bold rounded-lg shadow active:bg-blue-600">Join</button>
                </div>
            </div>
            <div class="border-t pt-4 space-y-2">
                <h3 class="font-bold">Host New Game</h3>
                <label class="block text-sm">Teams (2-4)</label>
                <input type="number" id="numTeams" value="2" min="2" max="4" class="w-full p-2 border rounded-lg">
                <label class="block text-sm">Words per Player</label>
                <input type="number" id="wordsReq" value="5" min="1" class="w-full p-2 border rounded-lg">
                <label class="block text-sm">Base Timer (seconds)</label>
                <input type="number" id="baseTime" value="60" min="10" class="w-full p-2 border rounded-lg">
                <button id="btn-create" class="w-full bg-indigo-500 text-white font-bold p-3 rounded-lg shadow active:bg-indigo-600 mt-2">Create Room</button>
            </div>
        </div>

        <div id="lobby-screen" class="hidden space-y-4 text-center">
            <h2 class="text-lg font-bold text-gray-500">Room Code</h2>
            <div id="displayRoomCode" class="text-6xl font-black text-indigo-600 tracking-widest bg-indigo-50 py-4 rounded-xl border-2 border-indigo-200"></div>
            <div class="bg-gray-50 p-4 rounded-lg border text-left mt-6">
                <h3 class="font-bold border-b pb-2 mb-2 text-gray-700">Players Joined</h3>
                <div id="player-roster" class="space-y-2 max-h-48 overflow-y-auto"></div>
            </div>
            <button id="btn-start-submit" class="hidden w-full bg-green-500 text-white font-bold p-4 text-xl rounded-lg shadow active:bg-green-600 mt-4 border-b-4 border-green-700">Lock Lobby & Write Words</button>
        </div>

        <div id="submit-screen" class="hidden space-y-4">
            <div id="submission-area">
                <h2 class="text-xl font-bold text-center">Enter your Nouns!</h2>
                <div id="word-inputs" class="space-y-2 mt-4"></div>
                <button id="btn-submit-words" class="w-full bg-indigo-500 text-white font-bold p-3 rounded-lg shadow mt-4">Toss in Bucket</button>
            </div>
            <div id="waiting-area" class="hidden space-y-4">
                <div class="text-center p-4 bg-green-100 text-green-800 rounded-lg font-bold">Words Submitted!</div>
                <button id="btn-hurry-up" class="w-full bg-red-500 text-white

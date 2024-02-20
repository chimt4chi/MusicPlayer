import "./App.css";
import React, { useState, useEffect, useRef } from "react";

const MusicPlayer = () => {
  const [db, setDb] = useState(null);
  const [songs, setSongs] = useState([]);
  const [audioSrc, setAudioSrc] = useState("");
  const [lastPlayedSongId, setLastPlayedSongId] = useState(null);
  const [lastPlaybackPosition, setLastPlaybackPosition] = useState(0);
  const [nowPlayingSong, setNowPlayingSong] = useState(null);

  const audioRef = useRef(null);

  useEffect(() => {
    openDatabase();
    resumeLastPlayedSong();
    // Add event listener for beforeunload
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (lastPlayedSongId) {
      const lastPlayedSong = songs.find((song) => song.id === lastPlayedSongId);
      if (lastPlayedSong) {
        playSong(lastPlayedSong, lastPlaybackPosition);
      }
    }
  }, [songs, lastPlayedSongId, lastPlaybackPosition]);

  const handleBeforeUnload = () => {
    // Close the database connection before the page is unloaded
    if (db) {
      db.close();
    }
  };

  const openDatabase = () => {
    const request = window.indexedDB.open("MusicPlayerDB", 1);

    request.onerror = (event) => {
      console.error("Database error:", event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const store = database.createObjectStore("songs", {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("title", "title", { unique: false });
    };

    request.onsuccess = (event) => {
      const database = event.target.result;
      setDb(database);
      displayPlaylist(database);
      resumeLastPlayedSong();
    };
  };

  const resumeLastPlayedSong = () => {
    const lastPlayedId = localStorage.getItem("lastPlayedSongId");
    const lastPlaybackPosition = localStorage.getItem("lastPlaybackPosition");
    if (lastPlayedId) {
      setLastPlayedSongId(parseInt(lastPlayedId, 10));
    }

    if (lastPlaybackPosition) {
      setLastPlaybackPosition(parseFloat(lastPlaybackPosition));
    }
  };
  const handleFileSelect = (event) => {
    const fileInput = event.target;
    const files = fileInput.files;

    if (files.length > 0) {
      const file = files[0];
      storeSong(file);
    }
  };

  const storeSong = async (file) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      const songData = {
        title: file.name,
        data: event.target.result,
      };

      const transaction = db.transaction(["songs"], "readwrite");
      const objectStore = transaction.objectStore("songs");

      const request = objectStore.add(songData);

      request.onsuccess = async () => {
        console.log("Song added to IndexedDB");
        displayPlaylist(db);
      };

      request.onerror = (event) => {
        console.error("Error adding song:", event.target.errorCode);
      };
    };

    reader.readAsArrayBuffer(file);
  };

  const displayPlaylist = async (database) => {
    const transaction = database.transaction(["songs"], "readonly");
    const objectStore = transaction.objectStore("songs");

    const request = objectStore.getAll();

    request.onsuccess = async (event) => {
      const songsList = event.target.result;
      setSongs(songsList);
    };

    request.onerror = (event) => {
      console.error("Error reading playlist:", event.target.errorCode);
    };
  };

  const playSong = (songData, startTime = 0) => {
    const blob = new Blob([songData.data], { type: "audio/*" });
    const objectURL = URL.createObjectURL(blob);

    // Update the audio source directly
    if (audioRef.current) {
      audioRef.current.src = objectURL;
      audioRef.current.currentTime = startTime;
      // audioRef.current.play();
    }

    setLastPlayedSongId(songData.id);
    localStorage.setItem("lastPlayedSongId", songData.id.toString());
    setNowPlayingSong(songData);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      localStorage.setItem("lastPlaybackPosition", currentTime.toString());
    }
  };

  const deleteSong = (songId) => {
    const transaction = db.transaction(["songs"], "readwrite");
    const objectStore = transaction.objectStore("songs");
    const request = objectStore.delete(songId);

    request.onsuccess = () => {
      console.log("Song deleted from IndexedDB");
      displayPlaylist(db);
    };

    request.onerror = (event) => {
      console.error("Error deleting song:", event.target.errorCode);
    };
  };

  return (
    <div className="container">
      <input
        className="fileInput"
        type="file"
        onChange={handleFileSelect}
        accept="audio/*"
      />
      <ul className="playlist">
        {songs.map((song) => (
          <li className="songItem" key={song.id} onClick={() => playSong(song)}>
            <span onClick={() => playSong(song)}>{song.title}</span>
            <button onClick={() => deleteSong(song.id)}>🗑️</button>
          </li>
        ))}
      </ul>
      <div className="nowPlaying">
        {nowPlayingSong && <div>Now Playing - {nowPlayingSong.title}</div>}
        <audio
          className="audioPlayer"
          controls
          src={audioSrc}
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
        ></audio>
      </div>
    </div>
  );
};

export default MusicPlayer;

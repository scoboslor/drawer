import React from 'react';
import CanvasDrawer from './canvas-drawer/CanvasDrawer';
import './App.css';

const App: React.FC = () => {
    return (
        <div className="App" style={{height: '100vh', width: '100vw'}}>
            <CanvasDrawer/>
        </div>
    );
};

export default App;
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Host from './Host';
import Viewer from './Viewer';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Host />} />
                <Route path="/viewer" element={<Viewer />} />
            </Routes>
        </BrowserRouter>
    );
}
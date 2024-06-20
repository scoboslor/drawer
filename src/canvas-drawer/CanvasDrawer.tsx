import React, {useCallback, useEffect, useState} from 'react';

interface CanvasDrawerProps {
    width?: number;
    height?: number;
    hideUI?: boolean;
}

enum ModeType {
    Select = 'select',
    Draw = 'draw',
    Erase = 'erase',
    Pan = 'pan',
}

enum ModeKeyCodes {
    select = 'V',
    draw = 'P',
    erase = 'E',
    pan = 'Space',
}

interface Point {
    x: number;
    y: number;
}

interface Path {
    color: string;
    lineWidth: number;
    points: Point[];
}

interface StraightPath {
    start?: Point;
    end?: Point;
    originalPath: Path;
}

interface Shape {
    id: string;
    path: Path;
    type?: string;
    erase?: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
    matrix: number[];
}

interface Selection {
    coordinates: Point;
    top: number;
    left: number;
    height: number;
    width: number;
    active: boolean;
}

const WheelButton: number = 1;
const maxZoom: number = 8;

const optionIcons: { [key in ModeType]: string } = {
    draw: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.636 23.182 1.599-3.73a.5.5 0 0 1 .106-.157L22.636 3 27 7.364 10.705 23.659a.5.5 0 0 1-.157.106l-3.73 1.599m-2.182-2.182L3 27l3.818-1.636m-2.182-2.182 2.182 2.182"/><path fill="#000" d="m3 27 1.714-4L7 25.286z"/></svg>`,
    erase: `<svg xmlns="http://www.w3.org/2000/svg"viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6.736 13.66-3.43 3.43a2 2 0 0 0 0 2.828l5.304 5.304a5 5 0 0 0 7.071 0l1.308-1.308M6.736 13.66 17.854 2.543l10.253 10.253L16.99 23.914M6.736 13.66 16.99 23.914"/></svg>`,
    select: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linejoin="round" stroke-width="2" d="m17.072 28.713 4.245-1.935-4.415-9.701 8.037-.355L7.123 1.287v23.55l5.525-5.826z"/></svg>`,
    pan: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.636 16.022c-.19-.723-.38-1.618-.78-2.95-.757-2.49-2.075-4.8-2.723-7.326-.425-1.81 1.12-3.643 3.046-2.969 2.949 1.036 3.868 6.109 4.283 8.678l.152.856c-.203-3.707-.469-6.126 0-9.172.463-2.89 4.888-2.825 5.254.038.189 2.079.19 4.154.19 6.242 0 .437 0 3.082.038 2.797.114-1.256.171-6.07.647-7.498 1.04-3.19 4.893-2.028 5.083.876.157 2.1-.062 4.29-.114 6.394 0 .076-.02.57.038.342.574-1.786.076-6.736 3.187-6.119 1.027.204 2.932 1.59 1.542 6.289-1.96 6.631-4.5 9.498-4.5 16.5h-14c0-5-6.61-8.82-8.5-12.598-.418-.799-.626-1.807-.36-2.53.438-1.123 1.254-1.713 2.568-1.58 2.142.206 3.008 2.032 4.949 3.73"/></svg>`
}

const CanvasDrawer: React.FC<CanvasDrawerProps> = ({width, height, hideUI = false}) => {
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(5);
    const [mode, setMode] = useState<ModeType>(ModeType.Select);
    const [paths, setPaths] = useState<Path[]>([]);
    const [currentPath, setCurrentPath] = useState<Path | null>(null);
    const [startPos, setStartPos] = useState<Point | null>(null);
    const [panOffset, setPanOffset] = useState<Point>({x: 0, y: 0});
    const [straightPath, setStraightPath] = useState<StraightPath>({});
    const [variableStrokeWidth, setVariableStrokeWidth] = useState<number>(1);
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [UIvisibility, setUIvisibility] = useState<boolean>(hideUI);
    const [zoom, setZoom] = useState<number>(1);
    const [selection, setSelection] = useState<Selection>({ left: 0, top: 0, active: false, coordinates: { x: 0, y: 0 }, height: 0, width: 0 });

    const pushShape = useCallback((path: Path) => {
        const [minX, minY, width, height] = calculateViewBox(path.points).split(" ");
        const shape: Shape = {
            id: Math.random().toString(32).substring(2),
            path: path,
            left: minX,
            top: minY,
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            matrix: [1, 0, 0, 1, 0, 0]
        };
        setShapes([...shapes, shape]);
    }, [shapes]);

    const removeShape = useCallback((id: string) => {
        const filteredShapes = shapes.filter(s => s.id !== id);
        setShapes(filteredShapes);
    }, [shapes]);

    function calculateViewBox(points: Point[]): string {
        // Initialize min and max values with the first point's coordinates
        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;

        // Iterate through the points to find the min and max values
        for (const point of points) {
            if (point.x < minX) minX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.x > maxX) maxX = point.x;
            if (point.y > maxY) maxY = point.y;
        }

        // Calculate width and height
        const width = maxX - minX;
        const height = maxY - minY;

        // Return the viewBox attribute as a string
        return `${minX} ${minY} ${width} ${height}`;
    }

    // function zoomF(zoom:number) {
    //     for (const shape of shapes) {
    //
    //         const centerX = shape.width / 2;
    //         const centerY = shape.height / 2;
    //
    //         const matrix:number[] = shape.matrix as number[];
    //
    //         for (var i = 0; i < 4; i++) {
    //             matrix[i] *= zoom;
    //         }
    //
    //         matrix[4] += (1 - zoom) * centerX;
    //         matrix[5] += (1 - zoom) * centerY;
    //
    //         shape.matrix = matrix;
    //         console.log(shape)
    //     }
    // }
    const zoomF = useCallback((zoom) => {
        const newShapes = shapes.map(shape => {
            const centerX = shape.width / 2;
            const centerY = shape.height / 2;

            const matrix = [...shape.matrix];

            // Scale the transformation matrix
            for (let i = 0; i < 4; i++) {
                matrix[i] *= zoom;
            }

            // Update translation to keep the shape centered
            matrix[4] = matrix[4] * zoom + (1 - zoom) * centerX;
            matrix[5] = matrix[5] * zoom + (1 - zoom) * centerY;

            return { ...shape, matrix };
        });

        setShapes(newShapes); // Update state to trigger re-render
    }, [shapes]);

    const panF = (dx:number, dy:number) => {
        /*
            const dx = (event.clientX - startPos.x) / zoom;
            const dy = (event.clientY - startPos.y) / zoom;
            setPanOffset(prev => ({x: prev.x + dx, y: prev.y + dy}));
            setStartPos({x: event.clientX, y: event.clientY});
         */

        const newShapes = shapes.map(shape => {
            const matrix = [...shape.matrix];

            matrix[4] += dx;
            matrix[5] += dy;

            return { ...shape, matrix };
        });

        setShapes(newShapes); // Update state to trigger re-render
    };

    // useEffect(() => {
    //     panF(panOffset.x, panOffset.y);
    // }, [panOffset]);

    const handleMouseDown = useCallback((event: MouseEvent) => {
        // console.log(event)
        const target = event.target as HTMLDivElement;
        if (target.closest('.config')) return;
        const {offsetX, offsetY} = event as any;
        const adjustedX = (offsetX - panOffset.x) / zoom;
        const adjustedY = (offsetY - panOffset.y) / zoom;

        // console.log(color)

        if (event.button === WheelButton || mode === ModeType.Pan) {
            setMode(ModeType.Pan);
            setStartPos({x: event.clientX, y: event.clientY});
            event.preventDefault();
        } else if (mode === ModeType.Draw && event.buttons === 1) {
            const newPath: Path = {color, lineWidth, points: [{x: adjustedX, y: adjustedY}]};
            setCurrentPath(newPath);
        } else if (mode === ModeType.Select) {
            const targetShape = target.closest('svg');

            if (targetShape) {
                targetShape.classList.add("target");
            } else {
                setSelection({
                    ...selection,
                    active: true,
                    top: event.offsetY,
                    left: event.offsetX,
                    coordinates: {
                        x: event.offsetX,
                        y: event.offsetY
                    }
                });
            }
        }
    }, [color, lineWidth, mode, panOffset, selection]);

    const handleMouseUp = useCallback(() => {
        if (currentPath) {
            let shape = currentPath;
            if (currentPath.points.length === 1) {
                shape = {...currentPath, points: [...currentPath.points, currentPath.points[0]]};
            }
            setPaths([...paths, shape]);
            pushShape(shape)
            setCurrentPath(null);
            setStraightPath({});
        }
        if (mode === ModeType.Pan) {
            setMode(ModeType.Select);

        } else if (mode === ModeType.Erase) {
            const idsToErase = shapes.filter(shape => shape?.erase).map(shape => shape.id);
            const filteredShapes = shapes.filter(shape => !idsToErase.includes(shape.id));
            setShapes(filteredShapes);

        } else if (mode === ModeType.Select) {
            setSelection({ left: 0, top: 0, active: false, coordinates: { x: 0, y: 0 }, height: 0, width: 0 });
        }
        setStartPos(null);
    }, [currentPath, mode, paths, pushShape, shapes]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        const {offsetX, offsetY, shiftKey} = event as any;
        const adjustedX = offsetX - panOffset.x;
        const adjustedY = offsetY - panOffset.y;

        if (mode === ModeType.Draw && shiftKey && currentPath) {
            if (!straightPath.start) {
                straightPath.start = currentPath.points[0];
                setCurrentPath(null);
            }
            straightPath.end = { x: adjustedX, y: adjustedY };

            const {start, end} = straightPath;

            const l = line(start, end);
            const angle = Math.round(l.angle / (Math.PI / 12)) * (Math.PI / 12);  // Round the angle to 15degrees segments
            const length = l.length;
            const x = start.x + Math.cos(angle) * length;
            const y = start.y + Math.sin(angle) * length;

            const newPath: Path = {color, lineWidth, points: [start, { x, y }]};

            setCurrentPath(newPath);

        } else if (mode === ModeType.Draw && currentPath && event.buttons === 1) {
            if (straightPath.originalPath) { // if shift release reset original path
                setCurrentPath(straightPath.originalPath);
            }
            console.log(adjustedX, adjustedX / zoom);
            const newPath = {...currentPath, points: [...currentPath.points, {x: adjustedX, y: adjustedY}]};
            setCurrentPath(newPath);

        } else if (mode === ModeType.Pan && startPos) {
            event.preventDefault();
            const dx = (event.clientX - startPos.x) / zoom;
            const dy = (event.clientY - startPos.y) / zoom;
            setPanOffset(prev => ({x: prev.x + dx, y: prev.y + dy}));
            setStartPos({x: event.clientX, y: event.clientY});
            // panF(dx, dy);
            // setStartPos({x: event.clientX, y: event.clientY});

        } else if (mode === ModeType.Erase && event.buttons === 1) {
            const target:EventTarget = event.target as EventTarget;
            if (!target) return;
            const targetShape:SVGElement = target.closest('svg');
            if (!targetShape) return;
            const shape = shapes.find(shape => shape.id === targetShape.dataset.shapeId);
            if (!shape) return;

            targetShape.classList.add('erase');
            shape.erase = true;

        } else if (mode === ModeType.Select && selection.active) {
            const { x, y } = selection.coordinates;
            let width:number = 0;
            let height:number = 0;
            let top:number = y;
            let left:number = x;
            if (adjustedX < x) {
                left = adjustedX;
                width = x - adjustedX;
            } else {
                width = adjustedX - x;
            }
            if (adjustedY < y) {
                top = adjustedY;
                height = y - adjustedY;
            } else {
                height = adjustedY - y;
            }
            setSelection({
                ...selection,
                width,
                height,
                top,
                left
            });
        }
        // if (mode === ModeType.Select && selection.active) {
        //     const { x, y } = selection.coordinates;
        //     let width:number = 0;
        //     let height:number = 0;
        //     let top:number = y;
        //     let left:number = x;
        //     console.log(adjustedX)
        //     if (adjustedX + panOffset.x < x) {
        //         left = offsetX;
        //         width = x - offsetX;
        //     } else {
        //         width = offsetX - x;
        //     }
        //     if (adjustedY + panOffset.y < y) {
        //         top = offsetY + panOffset.y;
        //         height = y - offsetY + panOffset.y;
        //     } else {
        //         console.log(2)
        //         height = offsetY - y;
        //     }
        //     setSelection({
        //         ...selection,
        //         width,
        //         height,
        //         top,
        //         left
        //     });
        // }

    }, [color, currentPath, lineWidth, mode, panOffset, selection, shapes, startPos, straightPath, zoom]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const {key, code, ctrlKey} = event;

        if (key === 'Control') {
            // TODO: zoom
            event.preventDefault();
        } else if (code === 'KeyP') {
            setMode(ModeType.Draw);

        } else if (code === 'KeyV') {
            setMode(ModeType.Select);

        } else if (code === 'KeyE') {
            setMode(ModeType.Erase);

        } else if (code === 'Space') {
            setMode(ModeType.Pan);

        } else if (code === 'KeyI') {
            const eyeDropper = new EyeDropper();

            eyeDropper
                .open()
                .then((result) => {
                    setColor(result.sRGBHex)
                })
                .catch((e) => {
                    console.log(e);
                });

        } else if (code === 'Backquote') {
            setUIvisibility(!UIvisibility);

        } else if (key === 'Shift' && mode === ModeType.Draw && currentPath) {
            const start: Point = currentPath?.points.at(0);
            const end: Point = currentPath?.points.at(-1);
            straightPath.originalPath = currentPath;
            const newPath: Path = {color, lineWidth, points: [start, end]};
            setCurrentPath(newPath);

        } else if (key === 'Delete') {
            document.querySelector('svg.target')?.remove();

        } else if (ctrlKey && code === 'KeyZ') {
            const lastShape: Shape = shapes.at(-1) as Shape;
            if (lastShape) {
                removeShape(lastShape.id);
            }
        }
        // if (mode === ModeType.Draw && currentPath) {
        //
        // }
    }, [UIvisibility, color, currentPath, lineWidth, mode, removeShape, shapes, straightPath]);

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        const {key, code, ctrlKey} = event;

        if (key === 'Shift' && mode === ModeType.Draw && currentPath) {
            if (straightPath.originalPath) {
                setCurrentPath(straightPath.originalPath);
            }
        } else if (code === ModeKeyCodes.pan) {
            setMode(ModeType.Select);
        }
    }, [currentPath, mode, straightPath.originalPath]);

    const handleZoom = useCallback((event: WheelEvent) => {
        event.preventDefault();

        console.log(event)

        if (event.altKey) {
            let factor: number = 1;

            if (event.shiftKey) {
                factor = 5;
            } else if (event.ctrlKey) {
                factor = 10;
            }

            setLineWidth(prevState => prevState - factor * Math.sign(event.deltaY));

        } else if (event.ctrlKey) {
            // const { offsetX, offsetY, deltaY } = event;
            //
            // // Calculate new zoom level
            // const newZoom = Math.max(0.1, zoom + (-deltaY / 10000 * maxZoom));
            //
            // // Calculate the new pan offset to keep the zoom centered around the mouse position
            // const zoomFactor = newZoom / zoom;
            // // const newPanX = offsetX - (offsetX - panOffset.x) * zoomFactor;
            // // const newPanY = offsetY - (offsetY - panOffset.y) * zoomFactor;
            //
            // const newPanX = (offsetX - panOffset.x) * zoomFactor;
            // const newPanY = (offsetY - panOffset.y) * zoomFactor;
            //
            // // use zoomF but with factor i.e : -0.25/0.25 etc
            //
            // setZoom(newZoom);
            // setPanOffset({ x: newPanX, y: newPanY });


            event.preventDefault();

            const scaleFactor = 1.1;
            const zoomIn = event.deltaY < 0;
            const newZoom = Math.min(maxZoom, Math.max(0.1, zoomIn ? zoom * scaleFactor : zoom / scaleFactor));

            const mouseX = event.clientX;
            const mouseY = event.clientY;

            // Adjust the pan offset to keep the zoom centered around the mouse position
            // const newPanX = (window.innerWidth / 2) - mouseX - panOffset.x;
            // const newPanY = (window.innerHeight / 2) - mouseY - panOffset.y;
            //
            // Fix the pan (right now alternates from the target to the center)
            const newPanX = (window.innerWidth / 2) - mouseX - panOffset.x * scaleFactor;
            const newPanY = (window.innerHeight / 2) - mouseY - panOffset.y * scaleFactor;

            console.log(newZoom)

            zoomF(zoomIn ? newZoom : 1 / newZoom);
            setZoom(newZoom);
            setPanOffset({ x: newPanX, y: newPanY });

        } else if (event.shiftKey) {
            setPanOffset({ x: panOffset.x - event.deltaY, y: panOffset.y - event.deltaX})

        } else  {
            setPanOffset({ x: panOffset.x - event.deltaX, y: panOffset.y - event.deltaY})
        }


    }, [panOffset, zoom, zoomF]);


    // const handleZoom = useCallback((event: WheelEvent) => {
    //     event.preventDefault();
    //
    //     const scaleFactor = 1.1;
    //     const zoomIn = event.deltaY < 0;
    //     const newZoom = Math.min(maxZoom, Math.max(0.1, zoomIn ? zoom * scaleFactor : zoom / scaleFactor));
    //
    //     const mouseX = event.clientX;
    //     const mouseY = event.clientY;
    //
    //     // Adjust the pan offset to keep the zoom centered around the mouse position
    //     const newPanX = (window.innerWidth / 2) - mouseX - panOffset.x;
    //     const newPanY = (window.innerHeight / 2) - mouseY - panOffset.y;
    //
    //     setZoom(newZoom);
    //     setPanOffset({ x: newPanX, y: newPanY });
    // }, [panOffset, zoom]);




    // Add event listeners to the window
    useEffect(() => {
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        document.addEventListener('wheel', handleZoom, { passive: false } );

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('wheel', handleZoom);
        };
    }, [currentPath, mode, startPos, panOffset, shapes, handleMouseDown, handleMouseUp, handleMouseMove, handleKeyDown, handleKeyUp, handleZoom]);


    // Helper functions for smoothing paths
    const line = (pointA: Point, pointB: Point) => {
        const lengthX = pointB.x - pointA.x;
        const lengthY = pointB.y - pointA.y;
        return {
            length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
            angle: Math.atan2(lengthY, lengthX)
        };
    };

    const controlPoint = (lineCalc: any, smooth: number) => (
        current: Point, previous: Point | null, next: Point | null, reverse?: boolean
    ) => {
        const p = previous || current;
        const n = next || current;
        const l = lineCalc(p, n);
        const angle = l.angle + (reverse ? Math.PI : 0);
        const length = l.length * smooth;
        const x = current.x + Math.cos(angle) * length;
        const y = current.y + Math.sin(angle) * length;
        return {x, y};
    };

    const bezierCommand = (controlPointCalc: any) => (
        point: Point, i: number, a: Point[]
    ) => {
        const cps = controlPointCalc(a[i - 1], a[i - 2], point);
        const cpe = controlPointCalc(point, a[i - 1], a[i + 1], true);
        return `C ${cps.x},${cps.y} ${cpe.x},${cpe.y} ${point.x},${point.y}`;
    };

    const createPathData = (points: Point[]): string => {
        const smoothing = 0.2;
        const controlPointCalc = controlPoint(line, smoothing);
        const bezierCommandCalc = bezierCommand(controlPointCalc);
        return points.reduce((acc, point, i, a) =>
                i === 0
                    ? `M ${point.x},${point.y}`
                    : `${acc} ${bezierCommandCalc(point, i, a)}`
            , '');
    };

    return (
        <div
            className={mode === ModeType.Select ? "selecting drawer" : mode === ModeType.Erase ? "erasing drawer" : "drawer"}>
            {!hideUI && (
                <div
                     className={UIvisibility ? "config hidden" : "config"}
                     style={{pointerEvents: (currentPath || selection.active) ? 'none' : 'all'}}>
                    <div>
                        <label
                            style={{
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'center',
                            }}>
                            Color:
                            <input type="color" value={color} onInput={e => setColor(e.target.value)}/>
                        </label>
                        <label
                            style={{
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'center',
                            }}>
                            Line Width:
                            <div className="slider-wrap">
                                <div className="size-indicator"
                                     style={{
                                         width: lineWidth,
                                         background: color,
                                         left: lineWidth * 120 / 50,
                                     }}></div>
                                <div className="slider">
                                    <input
                                        type="range" min={1} max={50} value={lineWidth}
                                        onChange={e => setLineWidth(parseInt(e.target.value, 10))}
                                    />
                                    <div className="slider__track"></div>
                                </div>
                            </div>
                        </label>
                        <div>
                            <button onClick={() => zoomF(1.2)}>+</button>
                            <button onClick={() => zoomF(0.8)}>-</button>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'center',
                            }}>
                            Mode:
                            {Object.values(ModeType).map((modeType, idx) => (
                                <button className={mode === modeType ? "selected toolBtn" : "toolBtn"}
                                        title={modeType.toUpperCase()[0] + modeType.substring(1) + " - " + ModeKeyCodes[modeType]}
                                        key={idx} onClick={() => setMode(modeType)}
                                        dangerouslySetInnerHTML={{__html: optionIcons[modeType]}}></button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <div className="canvas grid dots"
                 style={{
                     cursor: mode === ModeType.Pan ? 'grabbing' : 'crosshair',
                     overflow: 'hidden',
                     width: '100%',
                     height: '100%',
                     position: 'relative',
                     backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
                     backgroundSize: 18.5 * zoom
                 }}
            >
                <div
                    className="selection"
                    style={{
                        height: selection.height,
                        width: selection.width,
                        left: selection.left,
                        top: selection.top,
                    }}
                ></div>
                <div className="shapes"
                     style={{
                         // position: 'absolute',
                         // top: 0,
                         // left: 0,
                         // width: '100%',
                         // height: '100%',
                         // // top: '-49%',
                         // // left: '-49%',
                         // // width: `calc(100% / ${zoom})`,
                         // // height: `calc(100% / ${zoom})`,
                         // // transform: `scale(${zoom})`,
                         // pointerEvents: 'none',
                         position: 'absolute',
                         top: 0,
                         left: 0,
                         width: '1px',
                         height: '1px',
                         contain: 'layout style size',
                         transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                     }}
                >
                    {shapes.map((shape, index) => (
                        <div key={index}
                             className="shape"
                             style={{
                                 position: 'absolute',
                                 overflow: 'visible',
                                 contain: 'size layout',
                                 width: shape.width,
                                 height: shape.height,
                             }}
                        >
                            <svg
                                key={index}
                                data-shape-id={shape.id}
                                data-shape-width={shape.width}
                                data-shape-height={shape.height}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    // transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                                    overflow: 'visible',
                                    pointerEvents: mode === ModeType.Select || mode === ModeType.Erase ? 'all' : 'none',
                                }}
                            >
                                <g>{/*<g transform={"matrix(" + shape.matrix.join(" ") + ")" }>*/}
                                    <path
                                        className="shape"
                                        d={createPathData(shape.path.points)}
                                        stroke={shape.path.color}
                                        strokeWidth={shape.path.lineWidth}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        className="shape-outline"
                                        d={createPathData(shape.path.points)}
                                        stroke='#2A5FA5'
                                        strokeWidth={variableStrokeWidth} // todo change variable with zoom
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </g>
                            </svg>
                        </div>
                    ))}
                    {currentPath && (
                        // <svg
                        //     style={{
                        //         position: 'absolute',
                        //         top: 0,
                        //         left: 0,
                        //         width: '100%',
                        //         height: '100%',
                        //         transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                        //         overflow: 'visible'
                        //     }}
                        // >
                        //     <path
                        //         d={createPathData(currentPath.points)}
                        //         stroke={currentPath.color}
                        //         strokeWidth={currentPath.lineWidth}
                        //         fill="none"
                        //         strokeLinecap="round"
                        //         strokeLinejoin="round"
                        //     />
                        // </svg>
                        <div
                             className="shape"
                             style={{
                                 position: 'absolute',
                                 overflow: 'visible',
                                 contain: 'size layout',
                                 width: `${calculateViewBox(currentPath.points).split(" ")[2]}px`,
                                 height: `${calculateViewBox(currentPath.points).split(" ")[3]}px`,
                             }}
                        >
                            <svg
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    // transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                                    overflow: 'visible',
                                    pointerEvents: mode === ModeType.Select || mode === ModeType.Erase ? 'all' : 'none',
                                }}
                            >
                                    <path
                                        className="shape"
                                        d={createPathData(currentPath.points)}
                                        stroke={currentPath.color}
                                        strokeWidth={currentPath.lineWidth}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CanvasDrawer;
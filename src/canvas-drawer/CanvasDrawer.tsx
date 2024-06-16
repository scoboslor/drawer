import React, {useEffect, useRef, useState} from 'react';

interface CanvasDrawerProps {
    width?: number;
    height?: number;
    hideUI?: boolean;
}

enum ModeType {
    Draw = 'draw',
    Erase = 'erase',
    Select = 'select',
    Pan = 'pan',
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
}

interface Shape {
    id: string;
    path: Path;
    type?: string;
}

const WheelButton: number = 1;

const optionIcons: { [key in ModeType]: string } = {
    draw: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.636 23.182 1.599-3.73a.5.5 0 0 1 .106-.157L22.636 3 27 7.364 10.705 23.659a.5.5 0 0 1-.157.106l-3.73 1.599m-2.182-2.182L3 27l3.818-1.636m-2.182-2.182 2.182 2.182"/><path fill="#000" d="m3 27 1.714-4L7 25.286z"/></svg>`,
    erase: `<svg xmlns="http://www.w3.org/2000/svg"viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6.736 13.66-3.43 3.43a2 2 0 0 0 0 2.828l5.304 5.304a5 5 0 0 0 7.071 0l1.308-1.308M6.736 13.66 17.854 2.543l10.253 10.253L16.99 23.914M6.736 13.66 16.99 23.914"/></svg>`,
    select: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linejoin="round" stroke-width="2" d="m17.072 28.713 4.245-1.935-4.415-9.701 8.037-.355L7.123 1.287v23.55l5.525-5.826z"/></svg>`,
    pan: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="none"><path stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.636 16.022c-.19-.723-.38-1.618-.78-2.95-.757-2.49-2.075-4.8-2.723-7.326-.425-1.81 1.12-3.643 3.046-2.969 2.949 1.036 3.868 6.109 4.283 8.678l.152.856c-.203-3.707-.469-6.126 0-9.172.463-2.89 4.888-2.825 5.254.038.189 2.079.19 4.154.19 6.242 0 .437 0 3.082.038 2.797.114-1.256.171-6.07.647-7.498 1.04-3.19 4.893-2.028 5.083.876.157 2.1-.062 4.29-.114 6.394 0 .076-.02.57.038.342.574-1.786.076-6.736 3.187-6.119 1.027.204 2.932 1.59 1.542 6.289-1.96 6.631-4.5 9.498-4.5 16.5h-14c0-5-6.61-8.82-8.5-12.598-.418-.799-.626-1.807-.36-2.53.438-1.123 1.254-1.713 2.568-1.58 2.142.206 3.008 2.032 4.949 3.73"/></svg>`
}

const CanvasDrawer: React.FC<CanvasDrawerProps> = ({ width, height, hideUI }) => {
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(5);
    const [mode, setMode] = useState<ModeType>(ModeType.Draw);
    const [paths, setPaths] = useState<Path[]>([]);
    const [currentPath, setCurrentPath] = useState<Path | null>(null);
    const [startPos, setStartPos] = useState<Point | null>(null);
    const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
    const [straightPath, setStraightPath] = useState<StraightPath>({});
    const [variableStrokeWidth, setVariableStrokeWidth] = useState<number>(1);
    const [shapes, setShapes] = useState<Shape[]>([]);

    const handleMouseDown = (event: MouseEvent) => {
        console.log(event)
        const target = event.target as HTMLDivElement;
        if (target.closest('.config')) return;
        const { offsetX, offsetY } = event as any;
        const adjustedX = offsetX - panOffset.x;
        const adjustedY = offsetY - panOffset.y;

        // console.log(color)

        if (event.button === WheelButton) {
            setMode(ModeType.Pan);
            setStartPos({ x: event.clientX, y: event.clientY });
            event.preventDefault();
        } else if (mode === ModeType.Draw && event.buttons === 1) {
            const newPath: Path = { color, lineWidth, points: [{ x: adjustedX, y: adjustedY }] };
            setCurrentPath(newPath);
        } else if (mode === ModeType.Select) {
            const targetShape = target.closest('svg');
            console.log(targetShape)
            if (targetShape) {
                targetShape.classList.add("target");
            }
            // Implement selection logic
        }
    };

    const handleMouseUp = () => {
        if (currentPath) {
            let shape = currentPath;
            if (currentPath.points.length === 1) {
                shape = { ...currentPath, points: [...currentPath.points, currentPath.points[0]] };
            }
            setPaths([...paths, shape]);
            pushShape(shape)
            setCurrentPath(null);
        }
        if (mode === ModeType.Pan) {
            setMode(ModeType.Draw);
        }
        setStraightPath({});
        setStartPos(null);
    };

    const pushShape = (path: Path) => {
        const shape:Shape = {
            id:  Math.random().toString(32).substring(2),
            path: path
        };
        setShapes([...shapes, shape]);
        console.log(shapes)
    }

    const handleMouseMove = (event: MouseEvent) => {
        const { offsetX, offsetY, shiftKey } = event as any;
        const adjustedX = offsetX - panOffset.x;
        const adjustedY = offsetY - panOffset.y;

        if (mode === ModeType.Draw && shiftKey && currentPath) {
            // OPT 1: continue the drawing with a straight line
            // if (!straightPath.start) {
            //     straightPath.start = { x: adjustedX, y: adjustedY };
            //     console.log(paths)
            //     if (paths && currentPath) {
            //         setPaths([...paths, currentPath]);
            //     }
            //     setCurrentPath(null);
            // }
            // straightPath.end = { x: adjustedX, y: adjustedY };
            //
            // const { start, end } = straightPath;
            // const newPath: Path = { color, lineWidth, points: [start, end] };
            // setCurrentPath(newPath);

            // OPT 2: replace the current line with a straight line
            /*if (!straightPath.start) {
                straightPath.start = currentPath.points[0];
                setCurrentPath(null);
            }
            straightPath.end = { x: adjustedX, y: adjustedY };

            const { start, end } = straightPath;
            const newPath: Path = { color, lineWidth, points: [start, end] };
            setCurrentPath(newPath); */
            if (!straightPath.start) {
                straightPath.start = currentPath.points[0];
                setCurrentPath(null);
            }
            straightPath.end = { x: adjustedX, y: adjustedY };

            const { start, end } = straightPath;

            const l = line(start, end);
            const angle = l.angle;
            const length = l.length;
            const x = start.x + Math.cos(angle) * length;
            const y = start.y + Math.sin(angle) * length;

            console.log(`${angle * 180 / Math.PI}deg`)

            const newPath: Path = { color, lineWidth, points: [start, end] };

            setCurrentPath(newPath);

        } else if (mode === ModeType.Draw && currentPath && event.buttons === 1) {
            const newPath = { ...currentPath, points: [...currentPath.points, { x: adjustedX, y: adjustedY }] };
            setCurrentPath(newPath);
        } else if (mode === ModeType.Pan && startPos) {
            event.preventDefault();
            const dx = event.clientX - startPos.x;
            const dy = event.clientY - startPos.y;
            setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setStartPos({ x: event.clientX, y: event.clientY });
        } else if (mode === ModeType.Erase && event.buttons === 1) {
            const target = event.target?.closest('svg');
            if (!target) return;
            const targetShape = target.closest('svg');
            if (!targetShape) return;


        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        const { key, ctrlKey } = event;

        if (key === 'Control') {
            // TODO: zoom
            event.preventDefault();
        } else if (key === 'Shift' && mode === ModeType.Draw && currentPath) {
            const start = currentPath?.points.at(0);
            const end = currentPath?.points.at(-1);
            setCurrentPath(null);
            const newPath: Path = { color, lineWidth, points: [start, end] };
            setCurrentPath(newPath);
        } else if (key === 'Delete') {
            document.querySelector('svg.target')?.remove();
        } else if (ctrlKey && key.toLowerCase() === 'z') {
            const lastShape = shapes.at(-1);
            if (!lastShape) return;
            document.querySelector('svg.target')?.remove();
        }
        // if (mode === ModeType.Draw && currentPath) {
        //
        // }
    };

    const handleScroll = (event: Event) => {
        console.log(event)

    };

    // Add event listeners to the window
    useEffect(() => {
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('keydown', handleKeyDown);
        document.body.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
            document.body.removeEventListener('scroll', handleScroll);
        };
    }, [currentPath, mode, startPos, panOffset]);

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
        return { x, y };
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
        const d = points.reduce((acc, point, i, a) =>
                i === 0
                    ? `M ${point.x},${point.y}`
                    : `${acc} ${bezierCommandCalc(point, i, a)}`
            , '');
        return d;
    };

    // TODO: fix color change
    const i = (c:string) => {
        // console.log(c);
        // setColor((prevState) => {
        //     console.log(prevState)
        //     return c;
        // });
        setColor((prevState, props) => c);
    }

    return (
        <div className={mode === ModeType.Select ? "selecting drawer" : mode === ModeType.Erase ? "erasing drawer" : "drawer"}>
            {!hideUI && (
                <div className="config" style={{pointerEvents: currentPath ? 'none' : 'all'}}>
                    <label
                        style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                        }}>
                        Color:
                        <input type="color" value={color} onInput={e => i(e.target.value)}/>
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                        }}>
                        Line Width:
                        <div className="slider-wrap">
                            <div className="slider slider--brightness">
                                <input
                                    type="range" min={1} max={50} value={lineWidth}
                                    onChange={e => setLineWidth(parseInt(e.target.value, 10))}
                                />
                                <div className="slider__track"></div>
                            </div>
                        </div>
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                        }}>
                        Mode:
                        {Object.values(ModeType).map((modeType, idx) => (
                            <button className={mode === modeType ? "selected toolBtn" : "toolBtn"} title={modeType}
                                    key={idx} onClick={() => setMode(modeType)}
                                    dangerouslySetInnerHTML={{__html: optionIcons[modeType]}}></button>
                        ))}
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
                     backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
                 }}
            >
                <div className="shapes"
                     style={{
                         position: 'absolute',
                         top: 0,
                         left: 0,
                         width: '100%',
                         height: '100%',
                         // zIndex: -1,
                         pointerEvents: 'none',
                     }}
                >
                    {/*
                    {paths.map((path, index) => (
                        <svg
                            key={index}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                                overflow: 'visible',
                                pointerEvents: mode === ModeType.Select || mode === ModeType.Erase ? 'all' : 'none',
                            }}
                        >
                            <path
                                className="shape"
                                d={createPathData(path.points)}
                                stroke={path.color}
                                strokeWidth={path.lineWidth}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                className="shape-outline"
                                d={createPathData(path.points)}
                                stroke='#2A5FA5'
                                strokeWidth={variableStrokeWidth} // todo change variable with zoom
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    ))}
                    */}
                    {shapes.map((shape, index) => (
                        <svg
                            key={index}
                            data-shape-id={shape.id}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                                overflow: 'visible',
                                pointerEvents: mode === ModeType.Select || mode === ModeType.Erase ? 'all' : 'none',
                            }}
                        >
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
                        </svg>
                    ))}
                    {currentPath && (
                        <svg
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                                overflow: 'visible'
                            }}
                        >
                            <path
                                d={createPathData(currentPath.points)}
                                stroke={currentPath.color}
                                strokeWidth={currentPath.lineWidth}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CanvasDrawer;
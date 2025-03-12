import { useContext } from "react";
import { AppContext } from "../../context/appContext"
//import { point_direction } from "./gameMath";
import { useEventListener } from 'usehooks-ts'



const UserControl = () => {
    //const [mouse, setMouse] = useState({x:-1,y:-1})
    
    //npconst map = useRef<>

    const { socket,players,playersIds, mouse, pointerAngle, waiting } = useContext(AppContext);

    // const mapRef = document.getElementById('map');
    // // MOVE THE MOUSE OVER THE GAME
    // const mapPointerMoveEvent = (event: MouseEvent) => {
    //     let target = event.target as HTMLElement;
    //     if (target == null) return; 
    //     let rect = target.getBoundingClientRect();
    //     let x = Math.round(event.clientX - rect.left); //x position within the element.
    //     let y = Math.round(event.clientY - rect.top);  //y position within the element.
    //             //console.log("Left? : " + x + " ; Top? : " + y + ".");

    //             //const myId = playersIds[socket.id];
    //             //console.log("Angle: "+point_direction(players[myId].x,players[myId].y,x, y))
    //             setMouse({x:x,y:y})
    // }

    // useEventListener('pointermove',mapPointerMoveEvent) 
    // CLICK OVER THE GAME
    const clickOverMap = (event:MouseEvent) => {
        if (waiting) return;
        let target = event.target as HTMLElement;
        if (target == null) return; 
        let rect = target.getBoundingClientRect();
        let x = Math.round(event.clientX - rect.left); //x position within the element.
        let y = Math.round(event.clientY - rect.top);  //y position within the element.
        //console.log("CLICK!! Left? : " + x + " ; Top? : " + y + ".");
        
        socket.emit("move", { x: mouse.x, y: mouse.y })
    }
    useEventListener('click', clickOverMap)

    const keyUpEvent = (event:KeyboardEvent) => {
        event.preventDefault()
        if (waiting) return;
        console.log("players", players)
        // const keys = Object.keys(players)
        /* let myId = undefined
        for(let i = 0; i < keys.length; i++) {
            if (players[keys[i]].playerId === socket.id) {
                myId = keys[i]
                break;
            }
        } */
        //const myId = players.findIndex((player:any) => player.playerId == socket.id)[0];
        if ((event.key == "q")) {
            
            console.log("Pressing Q")
            //const myId = playersIds[socket.id];
            //console.log("pos player: x"+players[myId].x+", y:"+players[myId].y)

            const shotProjectileData = {
                mouse_x:mouse.x,
                mouse_y:mouse.y,//point_direction(players[myId].x,players[myId].y,mouse.x, mouse.y),
                who:socket.id
            }

            socket.emit("shotProjectil", shotProjectileData)
        }
        
        /* if (typeof myId == 'undefined') return;
        console.log("my_player",players[myId])
        const moveSlot = 32;
        if ((event.key == "ArrowUp")) {
            socket.emit("move", { x: players[myId].x , y: players[myId].y-moveSlot })
        }
        if ((event.key == "ArrowDown")) {
            socket.emit("move", { x: players[myId].x, y: players[myId].y+moveSlot })
        }
        if ((event.key == "ArrowLeft")) {
            socket.emit("move", { x: players[myId].x-moveSlot, y: players[myId].y })
        }
        if ((event.key == "ArrowRight")) {
            socket.emit("move", { x: players[myId].x+moveSlot, y: players[myId].y })
        } */
    }


    const keyDownEvent = (event:KeyboardEvent) => {
        event.preventDefault()
        if (waiting) return;
        console.log("players", players)
        const keys = Object.keys(players)
        let myId = undefined
        for(let i = 0; i < keys.length; i++) {
            if (players[keys[i]].playerId === socket.id) {
                myId = keys[i]
                break;
            }
        }
        if (typeof myId == 'undefined') return;
        console.log("my_player",players[myId])
        const moveSlot = 16;
        if ((event.key == "ArrowUp")) {
            socket.emit("move", { x: players[myId].x , y: players[myId].y-moveSlot })
        }
        if ((event.key == "ArrowDown")) {
            socket.emit("move", { x: players[myId].x, y: players[myId].y+moveSlot })
        }
        if ((event.key == "ArrowLeft")) {
            socket.emit("move", { x: players[myId].x-moveSlot, y: players[myId].y })
        }
        if ((event.key == "ArrowRight")) {
            socket.emit("move", { x: players[myId].x+moveSlot, y: players[myId].y })
        }
    }

    useEventListener('keyup', keyUpEvent)

    useEventListener('keydown', keyDownEvent)


    // useEventListener('scroll',(event:Event) => {
    //     console.log(event)
    // })

    useEventListener("contextmenu", (event:Event) => {
        event.preventDefault();
    })


    /*
    useEffect(() => {
        console.log("userControl(1) mounted")
        let map = document.getElementById('map')
        if (map != null) {

            map.addEventListener("pointermove", function(event) {
                let target = event.target as HTMLElement;
                if (target == null) return; 
                let rect = target.getBoundingClientRect();
                let x = Math.round(event.clientX - rect.left); //x position within the element.
                let y = Math.round(event.clientY - rect.top);  //y position within the element.
                //console.log("Left? : " + x + " ; Top? : " + y + ".");
                setMouse({x:x,y:y})
            })

            
        }
        */
        /*
        // THIS WORK FOR ONLY VIEWPORT
        document.addEventListener("click", (event) => {
            console.log("mx: " + event.clientX + ", my: " + event.clientY);


            socket.emit("move", { x: event.clientX, y: event.clientY })

        });*/

        
        /*
        return () => {
            //socket.off('signup', SignUpListener)
        }
    }, [])*/
    /*
    useEffect(() => {
        console.log("userControl(2) mounted")
        let map = document.getElementById('map')
        //let onclick = undefined;
        if (map != null) {
            map.onclick = function clickEvent(e) {
                // transioning to addEventListener("mouseover")
                // e = Mouse click event.
                /*let target = e.target as HTMLElement;
                if (target == null) return; 
                let rect = target.getBoundingClientRect();
                let x = Math.round(e.clientX - rect.left); //x position within the element.
                let y = Math.round(e.clientY - rect.top);  //y position within the element.
                console.log("Left? : " + x + " ; Top? : " + y + ".");
                setMouse({x:x,y:y})*/
                /*socket.emit("move", { x: mouse.x, y: mouse.y })
            }
        }
        document.addEventListener("contextmenu", (event) => {
            //console.log("mx: " + event.clientX + ", my: " + event.clientY);
            event.preventDefault();
            // 0 means right ciick on event.button
        });
        
        document.addEventListener("keyup", (event) => {
            if ((event.key == "q") && (cooldown == 0)) {
                setCooldown(1)
                setTimeout(() => {
                    setCooldown(0)
                },3000)
                console.log("Pressing Q")
                const myId = playersIds[socket.id];
                console.log("pos player: x"+players[myId].x+", y:"+players[myId].y)

                const shotProjectileData = {
                    x: players[myId].x,
                    y: players[myId].y,
                    angle:point_direction(players[myId].x,players[myId].y,mouse.x, mouse.y)+180,
                    who:socket.id
                }

                socket.emit("shotProjectil", shotProjectileData)
            }
        })

        /*setListener({
            ctxMenu:ctxMenu,
            keyup:keyup,
            onclick:onclick
        })*/
        //return () => {
            /*document.removeEventListener("keyup", Listener.xkeyup)
            document.removeEventListener("contextmenu",Listener.ctxMenu)
            let map = document.getElementById('map');
            if (map != null) map?.removeEventListener("onclick", Listener.xclick);*/

            //socket.off('signup', SignUpListener)
        /*}
    }, [])*/



    return (<>
    </>)
}

export default UserControl;


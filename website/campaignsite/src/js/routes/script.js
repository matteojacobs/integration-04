import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const routes = document.querySelectorAll(".pov__name");
console.log(routes);

const handleSwitchColors = (e) => {
    // :root {
    //     --current - pov - bg - color: #545CAB;
    //     --current - pov - text - color: white;
    //     --current - pov - secondary - color: #B7EA63;
    //     --current - download - color: #1E1E1E;
    // }
    console.log(e);
    let route;
    if (typeof e === 'string') {
        route = e;
    }
    else {
        route = e.target.dataset.pov;
    }

    if (route === "fashionista") {
        console.log("switch fashion colors");
        document.documentElement.style.setProperty('--current-pov-bg-color', '#B7EA63');
        document.documentElement.style.setProperty('--current-pov-text-color', '#1E1E1E');
        document.documentElement.style.setProperty('--current-pov-secondary-color', '#545CAB');
        document.documentElement.style.setProperty('--current-pov-shadow-color', '#545CAB');
        document.documentElement.style.setProperty('--current-pov-download-color', '#FFFFFF');
    }
    if (route === "mc") {
        console.log("switch mc colors");
        document.documentElement.style.setProperty('--current-pov-bg-color', '#545CAB');
        document.documentElement.style.setProperty('--current-pov-text-color', '#EAEBF5');
        document.documentElement.style.setProperty('--current-pov-secondary-color', '#B7EA63');
        document.documentElement.style.setProperty('--current-pov-shadow-color', '#FF70E8');
        document.documentElement.style.setProperty('--current-pov-download-color', '#1E1E1E');
    }
    if (route === "raver") {
        console.log("switch raver colors");
        document.documentElement.style.setProperty('--current-pov-bg-color', '#FF70E8');
        document.documentElement.style.setProperty('--current-pov-text-color', '#1E1E1E');
        document.documentElement.style.setProperty('--current-pov-secondary-color', '#545CAB');
        document.documentElement.style.setProperty('--current-pov-shadow-color', '#545CAB');
        document.documentElement.style.setProperty('--current-pov-download-color', '#FFFFFF');
    }
}

const handleToggleRoute = (e) => {
    const $currentRoute = document.querySelectorAll(".pov__route--active");
    const $currentClicked = document.querySelector(".pov__name--active");
    console.log($currentRoute);

    const clickedTarget = e.target;

    const clickedTargetRoute = document.querySelectorAll(`#${clickedTarget.dataset.pov}`);

    $currentClicked.classList.toggle("pov__name--active");
    clickedTarget.classList.toggle("pov__name--active");

    $currentRoute.forEach(current => {
        current.classList.toggle("pov__route--active");
    })

    clickedTargetRoute.forEach(clickedRoute => {
        clickedRoute.classList.toggle("pov__route--active")
    });

    handleSwitchColors(e);
}

const handleUrlRoute = (e) => {
    console.log(e);
    const $currentRoute = document.querySelectorAll(".pov__route--active");
    const $currentClicked = document.querySelector(".pov__name--active");

    const $availableRoutes = document.querySelectorAll(".pov__name");


    const selectedRoute = document.querySelectorAll(`#${e}`);

    $currentClicked.classList.toggle("pov__name--active");

    $availableRoutes.forEach(route => {
        if (route.dataset.pov === e) {
            route.classList.toggle("pov__name--active");
        }
    })

    $currentRoute.forEach(current => {
        current.classList.toggle("pov__route--active");
    })

    selectedRoute.forEach(routeUrl => {
        routeUrl.classList.toggle("pov__route--active")
    });

    handleSwitchColors(e);
}



const init = () => {
    routes.forEach(route => {
        route.addEventListener("click", handleToggleRoute);
    })

    const params = new URLSearchParams(window.location.search);
    const selectedRoute = params.get("route");

    console.log(selectedRoute); // "mc"

    if (selectedRoute != undefined) {
        handleUrlRoute(selectedRoute);
    }
}

init()
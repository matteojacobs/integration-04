import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const routes = document.querySelectorAll(".pov__name");
console.log(routes);

const handleToggleRoute = (e) => {
    const $currentRoute = document.querySelector(".pov__route--active");
    const $currentClicked = document.querySelector(".pov__name--active");
    console.log($currentRoute);

    const clickedTarget = e.target;

    const clickedTargetRoute = document.querySelector(`#${clickedTarget.dataset.pov}`);

    $currentClicked.classList.toggle("pov__name--active");
    clickedTarget.classList.toggle("pov__name--active");

    $currentRoute.classList.toggle("pov__route--active")
    clickedTargetRoute.classList.toggle("pov__route--active");

}

const init = () => {
    routes.forEach(route => {
        route.addEventListener("click", handleToggleRoute);
    })
}

init()
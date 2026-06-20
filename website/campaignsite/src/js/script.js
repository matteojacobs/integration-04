import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const routes = document.querySelectorAll(".pov__name");
console.log(routes);

const handleToggleHero = () => {
    let $heroImg = document.querySelectorAll('.hero__image');
    let $carouselDot = document.querySelectorAll('.carousel__dot');

    let currentIndex = 0

    console.log($heroImg[0]);
    console.log($carouselDot);

    window.setInterval(() => {
        document.querySelector('.hero__image--active').classList.toggle("hero__image--active");
        document.querySelector('.carousel__dot--active').classList.toggle("carousel__dot--active");

        if (currentIndex <= $carouselDot.length - 2) {
            $heroImg[currentIndex].classList.toggle("hero__image--active");
            $carouselDot[currentIndex].classList.toggle("carousel__dot--active");
            currentIndex++;
        }
        else {
            $heroImg[currentIndex].classList.toggle("hero__image--active");
            $carouselDot[currentIndex].classList.toggle("carousel__dot--active");
            currentIndex = 0;
        }
        console.log(currentIndex);
    }, 2500);
}

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
    console.log("hey");
    // handleToggleHero();
    routes.forEach(route => {
        route.addEventListener("click", handleToggleRoute);
    })
}

init()
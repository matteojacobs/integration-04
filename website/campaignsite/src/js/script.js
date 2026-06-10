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

const init = () => {
    console.log("hey");
    handleToggleHero();
}

init()
const apiKey = "a13483b3c6f0f851ebc72365a2f1c3d8";

async function getWeather() {

    const city = document.getElementById("cityInput").value;

    if(city === ""){
        alert("Please enter city name");
        return;
    }

    const loader = document.getElementById("loader");
    const weatherInfo = document.getElementById("weatherInfo");
    const error = document.getElementById("error");

    loader.style.display = "block";
    weatherInfo.style.display = "none";
    error.innerHTML = "";

    try{

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
        );

        if(!response.ok){
            throw new Error("City not found");
        }

        const data = await response.json();

        document.getElementById("city").innerHTML =
            `${data.name}, ${data.sys.country}`;

        document.getElementById("temp").innerHTML =
            `${Math.round(data.main.temp)}°C`;

        document.getElementById("desc").innerHTML =
            data.weather[0].description;

        document.getElementById("humidity").innerHTML =
            `${data.main.humidity}%`;

        document.getElementById("wind").innerHTML =
           `${data.wind.speed} m/s`;

        document.getElementById("icon").src =
            `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;

        weatherInfo.style.display = "block";

        changeBackground(data.weather[0].main);

    }catch(err){
        error.innerHTML = err.message;
    }

    loader.style.display = "none";
}

function changeBackground(weather){

    const body = document.body;

    switch(weather){

        case "Clear":
            body.style.background =
            "linear-gradient(135deg,#56CCF2,#2F80ED)";
            break;

        case "Clouds":
            body.style.background =
            "linear-gradient(135deg,#757F9A,#D7DDE8)";
            break;

        case "Rain":
            body.style.background =
            "linear-gradient(135deg,#232526,#414345)";
            break;

        case "Snow":
            body.style.background =
            "linear-gradient(135deg,#E6DADA,#274046)";
            break;

        default:
            body.style.background =
            "linear-gradient(135deg,#74ebd5,#ACB6E5)";
    }
}
let restaurant;
var newMap;

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  initMap();
  DBHelper.offlineAlert();
  DBHelper.submitOfflineReviews();
});

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
        mapboxToken: 'pk.eyJ1IjoidHJveTM0IiwiYSI6ImNqa2w1c2FoYzA1MGYza285aGx0cHVjNWIifQ.YTg83cMNLzog9aysZKZYjQ',
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
          '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
          'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox.streets'
      }).addTo(newMap);
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = async (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
  name.tabIndex = 0;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img'
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = `Image of the restaurant ${restaurant.name}`;
  image.tabIndex = 0;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }

  setFavDetails();
  // fetch reviews
  const reviews = await DBHelper.fetchReviews(restaurant.id);
  // fill reviews
  fillReviewsHTML(sortReviews(reviews));
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
  hours.tabIndex = 0;
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  title.tabIndex = 0;
  container.prepend(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);
  li.tabIndex = 0;

  const date = document.createElement('p');
  date.innerHTML = formatDate(review.createdAt);
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  li.setAttribute('aria-current', 'page')
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * Submit a review
 */
submitReview = async (event) => {
  const form = document.querySelector('#review-form');
  let review;
  event.preventDefault();
  const payload = {
    restaurant_id: Number(event.currentTarget.baseURI.split('=')[1]),
    name: event.srcElement[0].value,
    rating: event.srcElement[1].value,
    comments: event.srcElement[2].value
  };

  if (navigator.onLine) {
    review = await DBHelper.submitReview(payload);
    DBHelper.displayAlert('Your review has been submitted', 'success');
  } else {
    review = saveOfflineReview(payload);
    DBHelper.displayAlert("Your review has been saved. It will be submitted when you're online");
  }

  const reviewList = document.getElementById('reviews-list');
  reviewList.prepend(createReviewHTML(review));
  form.reset();
}

/**
 * Format review response date to human readable date
 */
formatDate = (timestamp) => {
  const date = new Date(timestamp);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-us', options)
}

/**
 * Sort reviews by date created
 */
sortReviews = (reviews) => {
  const customSort = (a, b) => new Date(b.createdAt) > new Date(a.createdAt);
  return reviews.sort(customSort);
}

saveOfflineReview = (review) => {
  setDbValue(null, review, 'offline-reviews');
  review.createdAt = Date.now();
  return review;
}

setFavDetails = () => {
  const restaurant = setFavToBoolean();

  if (restaurant.is_favorite === true) {
    toggleFavStyle('false', 'true');
  } else {
    toggleFavStyle('true', 'false');
  }
}

toggleFavStyle = (class1, class2) => {
  const favText = document.querySelector('.fav-text');
  const favStar = document.querySelector('.favourite');
  if (favText.classList.contains(class1)) favText.classList.remove(class1);
  if (favStar.classList.contains(class1)) favStar.classList.remove(class1);
  favText.classList.add(class2);
  favStar.classList.add(class2);
}

toggleFav = async () => {
  const restaurant = setFavToBoolean();
  const res = await DBHelper.toggleRestaurantFav(restaurant);
  if (res) {
    self.restaurant = res;
    setFavDetails();
  }
}

/**
 * Convert restaurant.is_favourite value to boolean. For some reasons the API sometimes returns a string instead of a boolean
 */
setFavToBoolean = (restaurant = self.restaurant) => {
  const fav = (restaurant.is_favorite === true || restaurant.is_favorite === 'true') ? true : false;
  restaurant.is_favorite = fav;
  return restaurant;
}

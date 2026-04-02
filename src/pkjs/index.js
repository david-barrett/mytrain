var myToken = "e995265f-df60-4787-bafc-af5a433f9b22";

var DEBUG = true; // Set to false when your National Rail token arrives!

function fetchTrainData(from, to, label) {
  console.log("Fetching trains for " + label + (DEBUG ? " [MOCK MODE]" : ""));

  var processResponse = function(response) {
    try {
      console.log("Starting to parse response...");

      // Flexible regex for both Mock and Real XML
      var serviceRegex = /<[^:>]*service>([\s\S]*?)<\/[^:>]*service>/g;
      var match;
      var validTrains = [];

      while ((match = serviceRegex.exec(response)) !== null) {
        var serviceXml = match[1];
        var stdMatch = serviceXml.match(/<[^:>]*std>([^<]+)/);
        var etdMatch = serviceXml.match(/<[^:>]*etd>([^<]+)/);
        
        if (stdMatch && etdMatch) {
          var std = stdMatch[1];
          var etd = etdMatch[1];
          if (etd === "Cancelled") continue;
          
          var liveTime = (etd.indexOf(":") !== -1) ? etd : std;
          var isDelayed = (etd.indexOf(":") !== -1 && etd !== std);
          
          validTrains.push({ 
            displayTime: liveTime, 
            scheduled: std, 
            status: etd, 
            delayed: isDelayed 
          });
          if (validTrains.length >= 3) break;
        }
      }

      if (validTrains.length > 0) {
        var primary = validTrains[0];
        
        // --- 1. DEFINE statusText ---
        var statusText = (primary.status.toLowerCase() === "on time") ? "ON TIME" : 
                         (primary.delayed ? "DELAYED (" + primary.scheduled + ")" : primary.status.toUpperCase());

        // --- 2. DEFINE nextString ---
        var followers = [];
        for (var i = 1; i < validTrains.length; i++) {
          var f = validTrains[i];
          var fTime = (f.status.indexOf(":") !== -1) ? f.status : f.scheduled;
          if (f.status.indexOf(":") !== -1 && f.status !== f.scheduled) { fTime += "*"; }
          followers.push(fTime);
        }
        var nextString = (followers.length > 0) ? followers.join(", ") : "End of service";

        console.log("Success! Sending to watch: " + statusText);
        
        Pebble.sendAppMessage({
          "STATION_LABEL": label,
          "TRAIN_INFO": statusText,
          "TRAIN_TIME": primary.displayTime,
          "NEXT_TRAIN": nextString
        });

      } else {
        console.log("No valid trains found. Sending 'NO SERVICE'.");
        Pebble.sendAppMessage({
          "STATION_LABEL": label,
          "TRAIN_INFO": "NO SERVICE", 
          "TRAIN_TIME": "--:--",
          "NEXT_TRAIN": "Check timetable"
        });
      }
    } catch (err) {
      console.log("JS CRASHED: " + err.message);
      Pebble.sendAppMessage({
        "STATION_LABEL": label, "TRAIN_INFO": "JS ERROR", "TRAIN_TIME": "500", "NEXT_TRAIN": "Check logs"
      });
    }
  };

  if (DEBUG) {
    var mockResponse = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetArrivalDepartureBoardResponse xmlns="http://thalesgroup.com/RTTI/2017-10-01/ldb/"><GetStationBoardResult><trainServices>' +
      '<service><std>15:45</std><etd>15:52</etd></service>' +
      '<service><std>16:05</std><etd>16:12</etd></service>' +
      '<service><std>16:20</std><etd>Cancelled</etd></service>' +
      '<service><std>16:35</std><etd>On time</etd></service>' +
      '</trainServices></GetStationBoardResult></GetArrivalDepartureBoardResponse></soap:Body></soap:Envelope>';
    processResponse(mockResponse);
  } else {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb9.asmx");
    xhr.setRequestHeader("Content-Type", "text/xml");
    xhr.onload = function() { processResponse(xhr.responseText); };
    xhr.send('...your xml string...');
  }
}

// function fetchTrainData(from, to, label) {
//   console.log("Mocking data for: " + from + " to " + to);
  
//   // Simulate a 1-second network delay
//   setTimeout(function() {
//     Pebble.sendAppMessage({
//       "STATION_LABEL": label,
//       "TRAIN_INFO": "On Time (Mock)",
//       "TRAIN_TIME": "14:45",
//       "NEXT_TRAIN": "15:45, 16:45"
//     });
//   }, 1000);
// }

function parseNextTrain(xml) {
  // Logic: Check first service. If 'Cancelled', look at second service.
  // Darwin XML returns <lt4:std> (scheduled) and <lt4:etd> (estimated/status)
  // You'll use regex or a small DOM parser here to find <service> tags.
  // For brevity, assume helper returns {status: "On Time", time: "14:05"}
}

function getDistance(lat1, lon1, lat2, lon2) {
  var p = 0.017453292519943295;    // Math.PI / 180
  var c = Math.cos;
  var a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)) * 0.621371; // Result in Miles
}

// Pebble.addEventListener("ready", function(e) {
//   console.log("JS is ready, waiting 1 second to mock...");
//   setTimeout(function() {
//     // Manually trigger the mock for testing
//     fetchTrainData("WGC", "KGX", "WGC > KGX"); 
//   }, 1000);
// });


Pebble.addEventListener("ready", function(e) {
  console.log("PebbleKit JS Ready! Fetching location...");

  navigator.geolocation.getCurrentPosition(function(pos) {
    var myLat = pos.coords.latitude;
    var myLon = pos.coords.longitude;
    console.log("Current Location: " + myLat + ", " + myLon);

    var distWGC = getDistance(myLat, myLon, 51.8010, -0.2050);
    var distKGX = getDistance(myLat, myLon, 51.5320, -0.1233);
    var distMOG = getDistance(myLat, myLon, 51.5185, -0.0881);
    
    console.log("Distances - WGC: " + distWGC.toFixed(2) + " mi, KGX: " + distKGX.toFixed(2) + " mi, MOG: " + distMOG.toFixed(2) + " mi");

    var limit = 10.0;
    var targetFrom = "";
    var targetTo = "WGC"; 
    var displayLabel = "";

    // Find the closest station within the 10-mile limit
    if (distWGC < limit && distWGC < distKGX && distWGC < distMOG) {
      targetFrom = "WGC";
      targetTo = "KGX";
      displayLabel = "WGC > KGX";
    } else if (distKGX < limit && distKGX <= distMOG) {
      targetFrom = "KGX";
      targetTo = "WGC";
      displayLabel = "KGX > WGC";
    } else if (distMOG < limit) {
      targetFrom = "MOG";
      targetTo = "WGC";
      displayLabel = "MOG > WGC";
    }

    if (targetFrom !== "") {
      console.log("Selected Route: " + displayLabel);
      fetchTrainData(targetFrom, targetTo, displayLabel);
    } else {
      console.log("No station within 10 miles.");
      Pebble.sendAppMessage({
        "STATION_LABEL": "Out of Range",
        "TRAIN_INFO": "Show", 
        "TRAIN_TIME": "N/A"
      });
    }
  }, function(err) {
    console.log("Location Error: " + err.message);
  }, { timeout: 15000, maximumAge: 60000 });
});
//Attach this script to a scene object in lens studio. then attach the correct items to it.

// @input SceneObject spotlight
// @input SceneObject sjerp
// @input SceneObject bg1
// @input SceneObject bg2
// @input SceneObject bg3
// @input Asset.RemoteServiceModule remoteServiceModule

script.spotlight.enabled = false;
script.sjerp.enabled = false;
script.bg1.enabled = false;
script.bg2.enabled = false;
script.bg3.enabled = false;

function applyState(state) {
  if (!state.extraAccessories) {
    return;
  }

  script.spotlight.enabled = state.extraAccessories.spotlight === true;
  script.sjerp.enabled = state.extraAccessories.sjerp === true;

  script.bg1.enabled = state.activeBackgroundId === "bg1";
  script.bg2.enabled = state.activeBackgroundId === "bg2";
  script.bg3.enabled = state.activeBackgroundId === "bg3";
}

function handleAPIResponse(response) {
  print("Remote API response statusCode: " + response.statusCode);

  if (response.statusCode !== 1) {
    print("Remote API error. statusCode: " + response.statusCode);
    return;
  }

  try {
    var state = JSON.parse(response.body);
    applyState(state);
  } catch (e) {
    print("Could not parse response body: " + e);
  }
}


function requestState() {
  var req = global.RemoteApiRequest.create();

  req.endpoint = "getState";
  req.parameters = {};

  script.remoteServiceModule.performApiRequest(req, handleAPIResponse);
}

var delayedEvent = script.createEvent("DelayedCallbackEvent");

function loop() {
  requestState();
  //every 0.2 seconds it asks the browser for state
  //not best solution but good for debugging
  delayedEvent.reset(0.7);
}

delayedEvent.bind(loop);
loop();


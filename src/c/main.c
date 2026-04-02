#include <pebble.h>

static Window *s_main_window;
static TextLayer *s_time_layer, *s_status_layer, *s_label_layer;
static TextLayer *s_current_clock_layer, *s_next_train_layer;

// Update the clock text
static void update_time() {
  time_t temp = time(NULL);
  struct tm *tick_time = localtime(&temp);

  static char s_buffer[8];
  strftime(s_buffer, sizeof(s_buffer), clock_is_24h_style() ? "%H:%M" : "%I:%M", tick_time);
  text_layer_set_text(s_current_clock_layer, s_buffer);
}

// Called every minute by the system
static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  update_time();
}

static void inbox_received_callback(DictionaryIterator *iterator, void *context) {
  Tuple *label_tuple = dict_find(iterator, MESSAGE_KEY_STATION_LABEL);
  Tuple *info_tuple = dict_find(iterator, MESSAGE_KEY_TRAIN_INFO);
  Tuple *time_tuple = dict_find(iterator, MESSAGE_KEY_TRAIN_TIME);
  Tuple *next_tuple = dict_find(iterator, MESSAGE_KEY_NEXT_TRAIN);

  if(label_tuple) text_layer_set_text(s_label_layer, label_tuple->value->cstring);
  if(info_tuple)  text_layer_set_text(s_status_layer, info_tuple->value->cstring);
  if(time_tuple)  text_layer_set_text(s_time_layer, time_tuple->value->cstring);
  if(next_tuple) text_layer_set_text(s_next_train_layer, next_tuple->value->cstring);                                    
}

static void main_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  // 1. TOP BAND: Route Label (Height 26)
  s_label_layer = text_layer_create(GRect(0, 0, bounds.size.w, 26));
  text_layer_set_background_color(s_label_layer, GColorWhite); 
  text_layer_set_text_color(s_label_layer, GColorBlack);
  text_layer_set_text(s_label_layer, "Locating...");
  text_layer_set_text_alignment(s_label_layer, GTextAlignmentCenter);
  text_layer_set_font(s_label_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  layer_add_child(window_layer, text_layer_get_layer(s_label_layer));

  // 2. MAIN TRAIN TIME: Switched to BITHAM_30_BLACK (Height 34)
  // Flush to top band at Y=26
  s_time_layer = text_layer_create(GRect(0, 26, bounds.size.w, 34));
  text_layer_set_background_color(s_time_layer, GColorClear);
  text_layer_set_text_color(s_time_layer, GColorWhite);
  text_layer_set_font(s_time_layer, fonts_get_system_font(FONT_KEY_BITHAM_30_BLACK));
  text_layer_set_text_alignment(s_time_layer, GTextAlignmentCenter);
  layer_add_child(window_layer, text_layer_get_layer(s_time_layer));

  // 3. MAIN STATUS: Gothic 24 Bold (Height 28)
  // Sits at Y=60
  s_status_layer = text_layer_create(GRect(0, 60, bounds.size.w, 28));
  text_layer_set_background_color(s_status_layer, GColorClear);
  text_layer_set_text_color(s_status_layer, GColorWhite);
  text_layer_set_text(s_status_layer, "Waiting...");
  text_layer_set_text_alignment(s_status_layer, GTextAlignmentCenter);
  text_layer_set_font(s_status_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  layer_add_child(window_layer, text_layer_get_layer(s_status_layer));
  
  // 4. NEXT TRAIN: Gothic 24 Bold (Height 28)
  // Sits at Y=88
  s_next_train_layer = text_layer_create(GRect(0, 88, bounds.size.w, 28));
  text_layer_set_background_color(s_next_train_layer, GColorClear);
  text_layer_set_text_color(s_next_train_layer, GColorWhite);
  text_layer_set_text_alignment(s_next_train_layer, GTextAlignmentCenter);
  text_layer_set_font(s_next_train_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  layer_add_child(window_layer, text_layer_get_layer(s_next_train_layer));
  
  // 5. BOTTOM BAND: Current Clock (Height 42)
  // Pushed back to the absolute bottom (Y=126)
  s_current_clock_layer = text_layer_create(GRect(0, bounds.size.h - 42, bounds.size.w, 42));
  text_layer_set_background_color(s_current_clock_layer, GColorWhite);
  text_layer_set_text_color(s_current_clock_layer, GColorBlack);
  text_layer_set_text_alignment(s_current_clock_layer, GTextAlignmentCenter);
  text_layer_set_font(s_current_clock_layer, fonts_get_system_font(FONT_KEY_BITHAM_30_BLACK));
  layer_add_child(window_layer, text_layer_get_layer(s_current_clock_layer));
}

static void init() {
  s_main_window = window_create();
  window_set_background_color(s_main_window, GColorBlack);
  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = main_window_load,
  });
  window_stack_push(s_main_window, true);

  // Start the Clock Timer
  tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
  update_time(); // Set initial time

  app_message_register_inbox_received(inbox_received_callback);
  app_message_open(256, 256); 
}

static void deinit() {
  tick_timer_service_unsubscribe();
  text_layer_destroy(s_time_layer);
  text_layer_destroy(s_status_layer);
  text_layer_destroy(s_next_train_layer);
  text_layer_destroy(s_label_layer);
  text_layer_destroy(s_current_clock_layer);
  window_destroy(s_main_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
  return 0;
}
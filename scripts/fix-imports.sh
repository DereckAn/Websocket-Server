#!/usr/bin/env bash
# Rewrites every moved module's import path to its @/ alias.
# Matches any leading ./ or ../ and either quote style; always emits single quotes.
set -euo pipefail
ROOT="${1:?pass the src dir}"

perl -pi -e '
  # --- multi-segment names first (must run before single-name rules) ---
  s{[\x27"][^\x27"]*types/gomoku[\x27"]}{\x27@/gomoku/types\x27}g;
  s{[\x27"][^\x27"]*types/square[\x27"]}{\x27@/square/types\x27}g;
  s{[\x27"]\@/gomoku/types[\x27"]}{\x27@/gomoku/types\x27}g;   # already-correct guess -> keep
  s{[\x27"][^\x27"]*routes/index[\x27"]}{\x27@/routes/index\x27}g;
  s{[\x27"][^\x27"]*/utils[\x27"]}{\x27@/shared\x27}g;         # bare utils index
    
  # --- shared ---
  s{[\x27"][^\x27"]*\blogger[\x27"]}{\x27@/shared/logger\x27}g;
  s{[\x27"][^\x27"]*\bshutdown[\x27"]}{\x27@/shared/shutdown\x27}g;
  s{[\x27"][^\x27"]*\benv[\x27"]}{\x27@/shared/env\x27}g;
  s{[\x27"][^\x27"]*\bcors[\x27"]}{\x27@/shared/cors\x27}g;
  s{[\x27"][^\x27"]*\brateLimit[\x27"]}{\x27@/shared/rateLimit\x27}g;
  s{[\x27"][^\x27"]*\bvalidation[\x27"]}{\x27@/shared/validation\x27}g;
  s{[\x27"][^\x27"]*\bResponseView[\x27"]}{\x27@/shared/ResponseView\x27}g;
  s{[\x27"][^\x27"]*\bGameView[\x27"]}{\x27@/shared/GameView\x27}g;

  # --- square (Admin/Online* before their shorter suffixes) ---
  s{[\x27"][^\x27"]*\bAdminWebSocketService[\x27"]}{\x27@/square/AdminWebSocketService\x27}g;
  s{[\x27"][^\x27"]*\bOnlineOrderService[\x27"]}{\x27@/square/OnlineOrderService\x27}g;
  s{[\x27"][^\x27"]*\bOnlineOrderController[\x27"]}{\x27@/square/OnlineOrderController\x27}g;
  s{[\x27"][^\x27"]*\bOnlineOrderModel[\x27"]}{\x27@/square/OnlineOrderModel\x27}g;
  s{[\x27"][^\x27"]*\bSquareService[\x27"]}{\x27@/square/SquareService\x27}g;
  s{[\x27"][^\x27"]*\bSquareController[\x27"]}{\x27@/square/SquareController\x27}g;
  s{[\x27"][^\x27"]*\bAdminController[\x27"]}{\x27@/square/AdminController\x27}g;
  s{[\x27"][^\x27"]*\bOrderModel[\x27"]}{\x27@/square/OrderModel\x27}g;
  s{[\x27"][^\x27"]*\bsquare-client[\x27"]}{\x27@/square/square-client\x27}g;
  s{[\x27"][^\x27"]*\bsupabase-client[\x27"]}{\x27@/square/supabase-client\x27}g;
  s{[\x27"][^\x27"]*\badminRoutes[\x27"]}{\x27@/square/adminRoutes\x27}g;
  s{[\x27"][^\x27"]*\bonlineOrderRoutes[\x27"]}{\x27@/square/onlineOrderRoutes\x27}g;
  s{[\x27"][^\x27"]*\bsquareRoutes[\x27"]}{\x27@/square/squareRoutes\x27}g;

  # --- gomoku (WebSocketService AFTER AdminWebSocketService) ---
  s{[\x27"][^\x27"]*\bWebSocketService[\x27"]}{\x27@/gomoku/WebSocketService\x27}g;
  s{[\x27"][^\x27"]*\bGameService[\x27"]}{\x27@/gomoku/GameService\x27}g;
  s{[\x27"][^\x27"]*\bAIService[\x27"]}{\x27@/gomoku/AIService\x27}g;
  s{[\x27"][^\x27"]*\bCleanupService[\x27"]}{\x27@/gomoku/CleanupService\x27}g;
  s{[\x27"][^\x27"]*\bOpeningBook[\x27"]}{\x27@/gomoku/OpeningBook\x27}g;
  s{[\x27"][^\x27"]*\bGomokuController[\x27"]}{\x27@/gomoku/GomokuController\x27}g;
  s{[\x27"][^\x27"]*\bGameModel[\x27"]}{\x27@/gomoku/GameModel\x27}g;
  s{[\x27"][^\x27"]*\bPlayerModel[\x27"]}{\x27@/gomoku/PlayerModel\x27}g;
  s{[\x27"][^\x27"]*\bRoomModel[\x27"]}{\x27@/gomoku/RoomModel\x27}g;
  s{[\x27"][^\x27"]*\bgomokuRoutes[\x27"]}{\x27@/gomoku/gomokuRoutes\x27}g;
' $(find "$ROOT" -name '*.ts')

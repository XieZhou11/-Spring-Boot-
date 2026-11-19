package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.OrderVO;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
/** 写事务结束后再读取订单，未知响应可按原请求安全复查。 */
@RestController @RequestMapping("/api/orders/{id}")
public class OrderFulfillmentController {
    private final OrderFulfillmentService fulfillment;private final OrderService orders;private final OrderNoStartRefundService refunds;
    public OrderFulfillmentController(OrderFulfillmentService fulfillment,OrderService orders,OrderNoStartRefundService refunds){this.fulfillment=fulfillment;this.orders=orders;this.refunds=refunds;}
    @PutMapping("/production-start") public ResponseEntity<Result<OrderVO>> start(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return result(p,id,fulfillment.start(p.userId(),id));}
    @PutMapping("/progress-nodes/{nodeId}/check-in") public ResponseEntity<Result<OrderVO>> checkIn(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@PathVariable Long nodeId,@Valid @RequestBody OrderCheckInDTO input){return result(p,id,fulfillment.checkIn(p.userId(),id,nodeId,input));}
    @PutMapping("/progress-nodes/{nodeId}/skip") public ResponseEntity<Result<OrderVO>> skip(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@PathVariable Long nodeId,@Valid @RequestBody OrderSkipDTO input){return result(p,id,fulfillment.skip(p.userId(),id,nodeId,input));}
    @PostMapping("/progress-nodes/{nodeId}/supplements") public ResponseEntity<Result<OrderVO>> supplement(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@PathVariable Long nodeId,@Valid @RequestBody OrderSupplementDTO input){return result(p,id,fulfillment.supplement(p.userId(),id,nodeId,input));}
    @PutMapping("/shipment") public ResponseEntity<Result<OrderVO>> ship(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody OrderShipmentDTO input){return result(p,id,fulfillment.ship(p.userId(),id,input));}
    @PutMapping("/shipment/tracking-number") public ResponseEntity<Result<OrderVO>> correct(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody OrderTrackingDTO input){fulfillment.correctTracking(p.userId(),id,input);return result(p,id,false);}
    @PutMapping("/receipt") public ResponseEntity<Result<OrderVO>> receive(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return result(p,id,fulfillment.receive(p.userId(),id));}
    @PutMapping("/no-start-refund") public ResponseEntity<Result<OrderVO>> refund(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody OrderNoStartRefundDTO input){return result(p,id,refunds.refund(p.userId(),id,input));}
    private ResponseEntity<Result<OrderVO>> result(AccountPrincipal p,Long id,boolean created){return ResponseEntity.status(created?201:200).body(Result.ok(orders.detail(p.userId(),id)));}
}

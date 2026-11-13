package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.AddressDTO;
import com.handcraft.platform.modules.dto.ProfileUpdateDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.AddressVO;
import com.handcraft.platform.modules.vo.ProfileVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** 本人资料及收货地址 REST 资源，永远不接收客户端自报用户编号。 */
@RestController
@RequestMapping("/api/me")
public class PersonalCenterController {
    private final PersonalProfileService profiles;
    private final ShippingAddressService addresses;
    private final AvatarService avatars;
    public PersonalCenterController(PersonalProfileService profiles,ShippingAddressService addresses,AvatarService avatars) {
        this.profiles=profiles; this.addresses=addresses; this.avatars=avatars;
    }
    @GetMapping("/profile")
    public Result<ProfileVO> profile(@AuthenticationPrincipal AccountPrincipal p) { return Result.ok(profiles.get(p.userId())); }
    @PutMapping("/profile")
    public Result<ProfileVO> updateProfile(@AuthenticationPrincipal AccountPrincipal p,@Valid @RequestBody ProfileUpdateDTO input) {
        return Result.ok(profiles.update(p.userId(),input));
    }
    @PutMapping(value="/avatar",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<ProfileVO> avatar(@AuthenticationPrincipal AccountPrincipal p,@RequestPart("file") MultipartFile file) {
        avatars.upload(p.userId(),file);
        return Result.ok(profiles.get(p.userId()));
    }
    @GetMapping("/addresses")
    public Result<List<AddressVO>> addresses(@AuthenticationPrincipal AccountPrincipal p) { return Result.ok(addresses.list(p.userId())); }
    @PostMapping("/addresses") @ResponseStatus(HttpStatus.CREATED)
    public Result<AddressVO> create(@AuthenticationPrincipal AccountPrincipal p,@Valid @RequestBody AddressDTO input) {
        return Result.ok(addresses.create(p.userId(),input));
    }
    @PutMapping("/addresses/{id}")
    public Result<AddressVO> update(@AuthenticationPrincipal AccountPrincipal p,@PathVariable @Positive Long id,@Valid @RequestBody AddressDTO input) {
        return Result.ok(addresses.update(p.userId(),id,input));
    }
    @DeleteMapping("/addresses/{id}")
    public Result<Void> delete(@AuthenticationPrincipal AccountPrincipal p,@PathVariable @Positive Long id) {
        addresses.delete(p.userId(),id); return Result.ok();
    }
    @PutMapping("/addresses/{id}/default")
    public Result<AddressVO> defaultAddress(@AuthenticationPrincipal AccountPrincipal p,@PathVariable @Positive Long id) {
        return Result.ok(addresses.setDefault(p.userId(),id));
    }
}

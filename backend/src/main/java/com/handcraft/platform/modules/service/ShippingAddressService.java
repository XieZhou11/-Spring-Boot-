package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.AddressDTO;
import com.handcraft.platform.modules.vo.AddressVO;
import java.util.List;

/** 收货地址业务接口，所有操作严格限定本人。 */
public interface ShippingAddressService {
    /** 查询本人地址，默认优先、最新地址在前。 */
    List<AddressVO> list(Long userId);
    /** 在用户行锁内校验最多十条并新增，首条自动默认。 */
    AddressVO create(Long userId, AddressDTO input);
    /** 更新本人地址，不能单独取消当前默认。 */
    AddressVO update(Long userId, Long id, AddressDTO input);
    /** 删除本人地址；删除默认时同事务选择剩余最新地址。 */
    void delete(Long userId, Long id);
    /** 原子设置本人默认地址，重复设置返回当前有效结果。 */
    AddressVO setDefault(Long userId, Long id);
}

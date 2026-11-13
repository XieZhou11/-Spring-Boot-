package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.ShippingAddress;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 参数化地址 SQL；所有写入在 Service 的用户行锁事务内执行。 */
@Mapper
public interface ShippingAddressMapper {
    String COLUMNS = "id,user_id,recipient_name,phone,province,city,district,detail_address,is_default AS default_address,created_at";

    @Select("SELECT " + COLUMNS + " FROM shipping_address WHERE user_id=#{userId} ORDER BY is_default DESC,created_at DESC,id DESC")
    List<ShippingAddress> list(Long userId);
    @Select("SELECT COUNT(*) FROM shipping_address WHERE user_id=#{userId}")
    int count(Long userId);
    @Select("SELECT " + COLUMNS + " FROM shipping_address WHERE id=#{id} AND user_id=#{userId} FOR UPDATE")
    ShippingAddress lockOwned(@Param("userId") Long userId, @Param("id") Long id);
    @Select("SELECT " + COLUMNS + " FROM shipping_address WHERE user_id=#{userId} ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE")
    ShippingAddress lockNewest(Long userId);
    @Insert("INSERT INTO shipping_address(user_id,recipient_name,phone,province,city,district,detail_address,is_default) VALUES(#{userId},#{recipientName},#{phone},#{province},#{city},#{district},#{detailAddress},#{defaultAddress})")
    @Options(useGeneratedKeys=true,keyProperty="id")
    int insert(ShippingAddress address);
    @Update("UPDATE shipping_address SET recipient_name=#{recipientName},phone=#{phone},province=#{province},city=#{city},district=#{district},detail_address=#{detailAddress},is_default=#{defaultAddress} WHERE id=#{id} AND user_id=#{userId}")
    int update(ShippingAddress address);
    @Update("UPDATE shipping_address SET is_default=0 WHERE user_id=#{userId} AND is_default=1")
    int clearDefault(Long userId);
    @Update("UPDATE shipping_address SET is_default=1 WHERE id=#{id} AND user_id=#{userId}")
    int setDefault(@Param("userId") Long userId,@Param("id") Long id);
    @Delete("DELETE FROM shipping_address WHERE id=#{id} AND user_id=#{userId}")
    int delete(@Param("userId") Long userId,@Param("id") Long id);
}
